'use strict';

const request = require('supertest');
const { app } = require('../src/app');
const { version } = require('../package.json');
const { useTestDatabase } = require('./helpers/db');

const testDb = useTestDatabase();

describe('GET /api/v1/health', () => {
  it('25. returns 200 JSON with every documented field and database "connected" with the memory server', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({
      status: 'ok',
      service: 'offershield-api',
      commit: null,
      version,
      environment: 'test',
      uptimeSeconds: expect.any(Number),
      timestamp: expect.any(String),
      database: 'connected',
    });
    expect(Number.isInteger(res.body.uptimeSeconds)).toBe(true);
    expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });

  it('reports database "disconnected" when mongoose is not connected', async () => {
    const { disconnectDB } = require('../src/config/db');
    await disconnectDB();

    try {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.database).toBe('disconnected');
    } finally {
      await testDb.connect();
    }
  });
});

describe('unknown routes', () => {
  it('returns 404 with the NOT_FOUND envelope', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
});
