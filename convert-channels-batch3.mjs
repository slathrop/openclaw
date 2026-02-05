/**
 * Bulk convert src/web/ and src/channels/ from TypeScript to JavaScript
 *
 * Excludes 4 type-heavy plugin files that need manual JSDoc conversion:
 * - channels/plugins/types.core.ts
 * - channels/plugins/types.adapters.ts
 * - channels/plugins/types.plugin.ts
 * - channels/plugins/types.ts (barrel)
 *
 * Pattern established in Phase 2-3 and refined in 04-02/04-03:
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
  join(ROOT, 'src/web'),
  join(ROOT, 'src/channels')
];

// Files that need manual conversion (type-heavy plugin files)
const EXCLUDE = new Set([
  join(ROOT, 'src/channels/plugins/types.core.ts'),
  join(ROOT, 'src/channels/plugins/types.adapters.ts'),
  join(ROOT, 'src/channels/plugins/types.plugin.ts'),
  join(ROOT, 'src/channels/plugins/types.ts')
]);

let converted = 0;
let deleted = 0;
let skipped = 0;
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
  code = code.replace(/^var __defProp = Object\.defineProperty;\n/m, '');
  code = code.replace(/^var __name = \(target, value\) => __defProp\(target, "name", \{ value, configurable: true \}\);\n/m, '');
  code = code.replace(/^__name\([^)]+\);\n/gm, '');
  code = code.replace(/\/\* @__PURE__ \*\/ __name\(([^,]+),\s*"[^"]+"\)/g, '$1');
  return code;
}

for (const srcDir of DIRS) {
  const files = findTsFiles(srcDir);
  const dirName = relative(ROOT, srcDir);
  console.log(`Found ${files.length} .ts files in ${dirName}/`);

  for (const file of files) {
    const relPath = relative(ROOT, file);

    if (EXCLUDE.has(file)) {
      console.log(`  SKIP (manual): ${relPath}`);
      skipped++;
      continue;
    }

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
console.log(`  Skipped:   ${skipped} (manual)`);
if (errors.length > 0) {
  console.log(`  Errors:    ${errors.length}`);
  for (const e of errors) {
    console.log(`    ${e.file}: ${e.error}`);
  }
}
