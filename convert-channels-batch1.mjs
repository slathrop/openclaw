/**
 * Bulk convert src/telegram/ and src/slack/ from TypeScript to JavaScript
 *
 * Pattern established in Phase 2-3:
 * - esbuild transformSync strips type annotations
 * - Fix import paths .ts -> .js
 * - Replace == null / != null with strict equality
 * - Add explanatory comments to empty catch blocks
 * - Remove unused imports left behind after type stripping
 */

import { transformSync } from 'esbuild';
import { readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const DIRS = [
  join(ROOT, 'src/telegram'),
  join(ROOT, 'src/slack')
];

let converted = 0;
let deleted = 0;
const errors = [];

/**
 * Recursively find all .ts files (excluding .d.ts)
 */
function findTsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findTsFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Fix import path extensions: .ts -> .js
 */
function fixImportPaths(code) {
  return code.replace(
    /((?:import|export)\s+.*?\s+from\s+['"])([^'"]+)\.ts(['"])/g,
    '$1$2.js$3'
  );
}

/**
 * Replace == null / != null with strict equality
 * CRITICAL: Must NOT match !== null or === null
 */
function fixNullEquality(code) {
  const lines = code.split('\n');
  const result = [];
  for (const line of lines) {
    let fixed = line;
    // Match pattern: <expr> == null (not === null)
    fixed = fixed.replace(/([a-zA-Z0-9_$.\[\]()]+)\s*==\s*null(?!\s*\|)/g, (match, expr) => {
      if (match.includes('===')) {return match;}
      return `${expr} === null || ${expr} === undefined`;
    });
    // Match pattern: <expr> != null (not !== null)
    fixed = fixed.replace(/([a-zA-Z0-9_$.\[\]()]+)\s*!=\s*null(?!\s*&)/g, (match, expr) => {
      if (match.includes('!==')) {return match;}
      return `${expr} !== null && ${expr} !== undefined`;
    });
    result.push(fixed);
  }
  return result.join('\n');
}

/**
 * Add explanatory comments to empty catch blocks
 */
function fixEmptyCatch(code) {
  return code.replace(
    /catch\s*\([^)]*\)\s*\{\s*\}/g,
    (match) => {
      const param = match.match(/catch\s*\(([^)]*)\)/)?.[1] || 'e';
      return `catch (${param}) {\n    // Intentionally ignored\n  }`;
    }
  );
}

/**
 * Fix empty catch with no parameter: catch { }
 */
function fixEmptyCatchNoParam(code) {
  return code.replace(
    /catch\s*\{\s*\}/g,
    'catch {\n    // Intentionally ignored\n  }'
  );
}

for (const srcDir of DIRS) {
  const files = findTsFiles(srcDir);
  const dirName = relative(ROOT, srcDir);
  console.log(`Found ${files.length} .ts files in ${dirName}/`);

  for (const file of files) {
    const relPath = relative(ROOT, file);
    try {
      const source = readFileSync(file, 'utf-8');
      const result = transformSync(source, {
        loader: 'ts',
        format: 'esm',
        target: 'esnext',
        keepNames: true
      });

      let code = result.code;

      // Fix import paths
      code = fixImportPaths(code);

      // Fix null equality
      code = fixNullEquality(code);

      // Fix empty catch blocks
      code = fixEmptyCatch(code);
      code = fixEmptyCatchNoParam(code);

      // Write .js file
      const jsFile = file.replace(/\.ts$/, '.js');
      writeFileSync(jsFile, code);
      converted++;

      // Delete .ts original
      unlinkSync(file);
      deleted++;
    } catch (err) {
      errors.push({ file: relPath, error: err.message });
      console.error(`ERROR converting ${relPath}: ${err.message}`);
    }
  }
}

console.log('\nConversion complete:');
console.log(`  Converted: ${converted}`);
console.log(`  Deleted:   ${deleted}`);
if (errors.length > 0) {
  console.log(`  Errors:    ${errors.length}`);
  for (const e of errors) {
    console.log(`    ${e.file}: ${e.error}`);
  }
}
