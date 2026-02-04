// eslint.config.js
// Unified linting and formatting configuration.
// Implements Google Standard JavaScript Style with one deviation:
// no trailing commas (Google requires them; this project prohibits them).
import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

export default defineConfig([
  globalIgnores([
    'apps/',
    'assets/',
    'dist/',
    'docs/_layouts/',
    'node_modules/',
    'patches/',
    'skills/',
    'src/canvas-host/a2ui/a2ui.bundle.js',
    'vendor/'
  ]),

  // Base JavaScript rules (Google Style)
  {
    name: 'base/recommended',
    files: ['**/*.js', '**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2025
      }
    },
    rules: {
      // Google Style: const/let, no var
      'no-var': 'error',
      // Google Style: prefer const over let when no reassignment
      'prefer-const': 'error',
      // Google Style: strict equality
      eqeqeq: ['error', 'always'],
      // Google Style: braces required for all control statements
      curly: ['error', 'all'],
      // Google Style: arrow callbacks preferred
      'prefer-arrow-callback': 'error',
      // Google Style: template literals over string concatenation
      'prefer-template': 'error',
      // Google Style: rest params over arguments object
      'prefer-rest-params': 'error',
      // Google Style: spread over .apply()
      'prefer-spread': 'error'
    }
  },

  // Stylistic / formatting rules (Google Style with no-trailing-comma deviation)
  {
    name: 'style/google-modified',
    files: ['**/*.js', '**/*.mjs'],
    plugins: {
      '@stylistic': stylistic
    },
    rules: {
      // Google Style: 2-space indent
      '@stylistic/indent': ['error', 2],
      // Google Style: single quotes (with escape exception)
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      // Google Style: always semicolons
      '@stylistic/semi': ['error', 'always'],
      // DEVIATION: Google Style requires trailing commas ('always-multiline').
      // This project prohibits them.
      '@stylistic/comma-dangle': ['error', 'never'],
      // Google Style: space before opening brace
      '@stylistic/space-before-blocks': 'error',
      // Google Style: space around keywords (if, else, for, etc.)
      '@stylistic/keyword-spacing': 'error',
      // Google Style: space around infix operators (+, -, =, etc.)
      '@stylistic/space-infix-ops': 'error',
      // Google Style: space after comma, not before
      '@stylistic/comma-spacing': ['error', { before: false, after: true }],
      // Max line length: warn at 100 to avoid noise during conversion.
      // Google Style recommends 80; will tighten in later phases.
      '@stylistic/max-len': ['warn', {
        code: 100,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true
      }]
    }
  },

  // JSDoc validation (validate what's present; don't require it everywhere)
  {
    name: 'jsdoc/recommended',
    files: ['src/**/*.js'],
    extends: [jsdoc.configs['flat/recommended']],
    rules: {
      // Don't require JSDoc on every function -- only validate docs that exist
      'jsdoc/require-jsdoc': 'off',
      // When JSDoc IS present, enforce correctness
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-types': 'error',
      'jsdoc/valid-types': 'error'
    }
  }
]);
