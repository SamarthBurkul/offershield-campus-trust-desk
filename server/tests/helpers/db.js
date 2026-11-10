'use strict';

const os = require('node:os');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDB, disconnectDB } = require('../../src/config/db');

async function clearDatabase() {
  // Native driver deleteMany keeps indexes and bypasses the AuditLog append-only hooks (test teardown only).
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

/**
 * Register Jest hooks for a private in-memory MongoDB per test file.
 * Tests never read server/.env and never connect to Atlas.
 * Returns helpers to reconnect after a test deliberately disconnects.
 */
function useTestDatabase() {
  let server;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await connect();
  });

  async function connect() {
    // The driver loads 'os' with a dynamic import(), which Jest's CommonJS sandbox cannot run;
    // without it the handshake metadata is empty and MongoDB rejects the connection.
    await connectDB(server.getUri(), { runtimeAdapters: { os } });
  }

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectDB();
    if (server) await server.stop();
  });

  return { connect };
}

module.exports = { useTestDatabase, clearDatabase };
