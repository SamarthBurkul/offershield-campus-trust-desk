'use strict';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  clearMocks: true,
  restoreMocks: true,
  // Starting mongodb-memory-server and bcrypt (cost 12) are slow on first use.
  testTimeout: 30000,
};
