'use strict';

const mongoose = require('mongoose');

// Reject query filters on fields that are not in the schema (defence against operator injection).
mongoose.set('strictQuery', true);

/**
 * Connect the shared mongoose connection. The URI is never logged.
 * @param {string} uri
 * @param {import('mongoose').ConnectOptions} [options] extra driver options (used by the test helper)
 */
async function connectDB(uri, options = {}) {
  if (!uri) throw new Error('A MongoDB connection string is required');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, ...options });
  // Build the unique and compound indexes declared on the models.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

/** @returns {'connected' | 'disconnected'} */
function getDatabaseStatus() {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected ? 'connected' : 'disconnected';
}

module.exports = { connectDB, disconnectDB, getDatabaseStatus };
