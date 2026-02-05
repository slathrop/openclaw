import JSZip from 'jszip';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isPathWithinBase } from '../../test/helpers/paths.js';
describe('media store', () => {
  let store;
  let home = '';
  const envSnapshot = {};
  const snapshotEnv = () => {
    for (const key of ['HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'OPENCLAW_STATE_DIR']) {
      envSnapshot[key] = process.env[key];
    }
  };
  const restoreEnv = () => {
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value === void 0) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
  beforeAll(async () => {
    snapshotEnv();
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-test-home-'));
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    process.env.OPENCLAW_STATE_DIR = path.join(home, '.openclaw');
    if (process.platform === 'win32') {
      const match = home.match(/^([A-Za-z]:)(.*)$/);
      if (match) {
        process.env.HOMEDRIVE = match[1];
        process.env.HOMEPATH = match[2] || '\\';
      }
    }
    await fs.mkdir(path.join(home, '.openclaw'), { recursive: true });
    store = await import('./store.js');
  });
  afterAll(async () => {
    restoreEnv();
    try {
      await fs.rm(home, { recursive: true, force: true });
    } catch {
      // Intentionally ignored
    }
  });
  async function withTempStore(fn) {
    return await fn(store, home);
  }
  it('creates and returns media directory', async () => {
    await withTempStore(async (store2, home2) => {
      const dir = await store2.ensureMediaDir();
      expect(isPathWithinBase(home2, dir)).toBe(true);
      expect(path.normalize(dir)).toContain(`${path.sep}.openclaw${path.sep}media`);
      const stat = await fs.stat(dir);
      expect(stat.isDirectory()).toBe(true);
    });
  });
  it('saves buffers and enforces size limit', async () => {
    await withTempStore(async (store2) => {
      const buf = Buffer.from('hello');
      const saved = await store2.saveMediaBuffer(buf, 'text/plain');
      const savedStat = await fs.stat(saved.path);
      expect(savedStat.size).toBe(buf.length);
      expect(saved.contentType).toBe('text/plain');
      expect(saved.path.endsWith('.txt')).toBe(true);
      const jpeg = await sharp({
        create: { width: 2, height: 2, channels: 3, background: '#123456' }
      }).jpeg({ quality: 80 }).toBuffer();
      const savedJpeg = await store2.saveMediaBuffer(jpeg, 'image/jpeg');
      expect(savedJpeg.contentType).toBe('image/jpeg');
      expect(savedJpeg.path.endsWith('.jpg')).toBe(true);
      const huge = Buffer.alloc(5 * 1024 * 1024 + 1);
      await expect(store2.saveMediaBuffer(huge)).rejects.toThrow('Media exceeds 5MB limit');
    });
  });
  it('copies local files and cleans old media', async () => {
    await withTempStore(async (store2, home2) => {
      const srcFile = path.join(home2, 'tmp-src.txt');
      await fs.mkdir(home2, { recursive: true });
      await fs.writeFile(srcFile, 'local file');
      const saved = await store2.saveMediaSource(srcFile);
      expect(saved.size).toBe(10);
      const savedStat = await fs.stat(saved.path);
      expect(savedStat.isFile()).toBe(true);
      expect(path.extname(saved.path)).toBe('.txt');
      const past = Date.now() - 1e4;
      await fs.utimes(saved.path, past / 1e3, past / 1e3);
      await store2.cleanOldMedia(1);
      await expect(fs.stat(saved.path)).rejects.toThrow();
    });
  });
  it('sets correct mime for xlsx by extension', async () => {
    await withTempStore(async (store2, home2) => {
      const xlsxPath = path.join(home2, 'sheet.xlsx');
      await fs.mkdir(home2, { recursive: true });
      await fs.writeFile(xlsxPath, 'not really an xlsx');
      const saved = await store2.saveMediaSource(xlsxPath);
      expect(saved.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(path.extname(saved.path)).toBe('.xlsx');
    });
  });
  it('renames media based on detected mime even when extension is wrong', async () => {
    await withTempStore(async (store2, home2) => {
      const pngBytes = await sharp({
        create: { width: 2, height: 2, channels: 3, background: '#00ff00' }
      }).png().toBuffer();
      const bogusExt = path.join(home2, 'image-wrong.bin');
      await fs.writeFile(bogusExt, pngBytes);
      const saved = await store2.saveMediaSource(bogusExt);
      expect(saved.contentType).toBe('image/png');
      expect(path.extname(saved.path)).toBe('.png');
      const buf = await fs.readFile(saved.path);
      expect(buf.equals(pngBytes)).toBe(true);
    });
  });
  it('sniffs xlsx mime for zip buffers and renames extension', async () => {
    await withTempStore(async (store2, home2) => {
      const zip = new JSZip();
      zip.file(
        '[Content_Types].xml',
        '<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>'
      );
      zip.file('xl/workbook.xml', '<workbook/>');
      const fakeXlsx = await zip.generateAsync({ type: 'nodebuffer' });
      const bogusExt = path.join(home2, 'sheet.bin');
      await fs.writeFile(bogusExt, fakeXlsx);
      const saved = await store2.saveMediaSource(bogusExt);
      expect(saved.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(path.extname(saved.path)).toBe('.xlsx');
    });
  });
  describe('extractOriginalFilename', () => {
    it('extracts original filename from embedded pattern', async () => {
      await withTempStore(async (store2) => {
        const filename = 'report---a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf';
        const result = store2.extractOriginalFilename(`/path/to/${filename}`);
        expect(result).toBe('report.pdf');
      });
    });
    it('handles uppercase UUID pattern', async () => {
      await withTempStore(async (store2) => {
        const filename = 'Document---A1B2C3D4-E5F6-7890-ABCD-EF1234567890.docx';
        const result = store2.extractOriginalFilename(`/media/inbound/${filename}`);
        expect(result).toBe('Document.docx');
      });
    });
    it('falls back to basename for non-matching patterns', async () => {
      await withTempStore(async (store2) => {
        const uuidOnly = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf';
        expect(store2.extractOriginalFilename(`/path/${uuidOnly}`)).toBe(uuidOnly);
        expect(store2.extractOriginalFilename('/path/to/regular.txt')).toBe('regular.txt');
        expect(store2.extractOriginalFilename('/path/to/foo---bar.txt')).toBe('foo---bar.txt');
      });
    });
    it('preserves original name with special characters', async () => {
      await withTempStore(async (store2) => {
        const filename = '\u62A5\u544A_2024---a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf';
        const result = store2.extractOriginalFilename(`/media/${filename}`);
        expect(result).toBe('\u62A5\u544A_2024.pdf');
      });
    });
  });
  describe('saveMediaBuffer with originalFilename', () => {
    it('embeds original filename in stored path when provided', async () => {
      await withTempStore(async (store2) => {
        const buf = Buffer.from('test content');
        const saved = await store2.saveMediaBuffer(
          buf,
          'text/plain',
          'inbound',
          5 * 1024 * 1024,
          'report.txt'
        );
        expect(saved.id).toMatch(/^report---[a-f0-9-]{36}\.txt$/);
        expect(saved.path).toContain('report---');
        const extracted = store2.extractOriginalFilename(saved.path);
        expect(extracted).toBe('report.txt');
      });
    });
    it('sanitizes unsafe characters in original filename', async () => {
      await withTempStore(async (store2) => {
        const buf = Buffer.from('test');
        const saved = await store2.saveMediaBuffer(
          buf,
          'text/plain',
          'inbound',
          5 * 1024 * 1024,
          'my<file>:test.txt'
        );
        expect(saved.id).toMatch(/^my_file_test---[a-f0-9-]{36}\.txt$/);
      });
    });
    it('truncates long original filenames', async () => {
      await withTempStore(async (store2) => {
        const buf = Buffer.from('test');
        const longName = `${'a'.repeat(100)  }.txt`;
        const saved = await store2.saveMediaBuffer(
          buf,
          'text/plain',
          'inbound',
          5 * 1024 * 1024,
          longName
        );
        const baseName = path.parse(saved.id).name.split('---')[0];
        expect(baseName.length).toBeLessThanOrEqual(60);
      });
    });
    it('falls back to UUID-only when originalFilename not provided', async () => {
      await withTempStore(async (store2) => {
        const buf = Buffer.from('test');
        const saved = await store2.saveMediaBuffer(buf, 'text/plain', 'inbound');
        expect(saved.id).toMatch(/^[a-f0-9-]{36}\.txt$/);
        expect(saved.id).not.toContain('---');
      });
    });
  });
});
