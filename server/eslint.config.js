'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/', 'coverage/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Config must come from src/config/env.js only.
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Read configuration from src/config/env.js instead.' },
      ],
    },
  },
  {
    files: ['src/config/env.js'],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.jest } },
  },
];
