/**
 * Bulk convert src/signal/, src/imessage/, src/feishu/, src/line/ from TypeScript to JavaScript
 *
 * Pattern established in Phase 2-3 and refined in 04-02:
 * - esbuild transformSync strips type annotations
 * - NO keepNames (avoids __defProp/__name boilerplate that breaks vi.mock hoisting)
 * - Fix import paths .ts -> .js
 * - Replace == null / != null with strict equality (word-boundary regex)
 * - Add explanatory comments to empty catch blocks
 * - Strip any remaining __defProp/__name boilerplate
 */

import { transformSync } from 'esbuild';
import { readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const DIRS = [
  join(ROOT, 'src/signal'),
  join(ROOT, 'src/imessage'),
  join(ROOT, 'src/feishu'),
  join(ROOT, 'src/line')
];

let converted = 0;
let deleted = 0;
const errors = [];

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

function fixImportPaths(code) {
  return code.replace(
    /((?:import|export)\s+.*?\s+from\s+['"])([^'"]+)\.ts(['"])/g,
    '$1$2.js$3'
  );
}

/**
 * Replace == null / != null with strict equality
 * Uses word boundary to avoid capturing parens or matching === / !==
 */
function fixNullEquality(code) {
  const lines = code.split('\n');
  const result = [];
  for (const line of lines) {
    let fixed = line;
    // Match: identifier.chain == null (not ===)
    fixed = fixed.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$?.]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$?.]*)*)\s*==\s*null\b/g, (match, expr) => {
      if (match.includes('===')) {return match;}
      return `${expr} === null || ${expr} === undefined`;
    });
    // Match: identifier.chain != null (not !==)
    fixed = fixed.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$?.]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$?.]*)*)\s*!=\s*null\b/g, (match, expr) => {
      if (match.includes('!==')) {return match;}
      return `${expr} !== null && ${expr} !== undefined`;
    });
    result.push(fixed);
  }
  return result.join('\n');
}

function fixEmptyCatch(code) {
  return code.replace(
    /catch\s*\([^)]*\)\s*\{\s*\}/g,
    (match) => {
      const param = match.match(/catch\s*\(([^)]*)\)/)?.[1] || 'e';
      return `catch (${param}) {\n    // Intentionally ignored\n  }`;
    }
  );
}

function fixEmptyCatchNoParam(code) {
  return code.replace(
    /catch\s*\{\s*\}/g,
    'catch {\n    // Intentionally ignored\n  }'
  );
}

/**
 * Strip esbuild keepNames boilerplate (__defProp/__name wrappers)
 * These break vitest vi.mock hoisting
 */
function stripEsbuildBoilerplate(code) {
  // Remove var __defProp = ... line
  code = code.replace(/^var __defProp = Object\.defineProperty;\n/m, '');
  // Remove var __name = ... line
  code = code.replace(/^var __name = \(target, value\) => __defProp\(target, "name", \{ value, configurable: true \}\);\n/m, '');
  // Remove standalone __name(...) calls
  code = code.replace(/^__name\([^)]+\);\n/gm, '');
  // Remove inline /* @__PURE__ */ __name(...) wrapping
  code = code.replace(/\/\* @__PURE__ \*\/ __name\(([^,]+),\s*"[^"]+"\)/g, '$1');
  return code;
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
        target: 'esnext'
      });

      let code = result.code;
      code = stripEsbuildBoilerplate(code);
      code = fixImportPaths(code);
      code = fixNullEquality(code);
      code = fixEmptyCatch(code);
      code = fixEmptyCatchNoParam(code);

      const jsFile = file.replace(/\.ts$/, '.js');
      writeFileSync(jsFile, code);
      converted++;

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
