'use strict';

const authService = require('../services/auth.service');
const { signSessionToken, setSessionCookie, clearSessionCookie } = require('../utils/jwt');

function createAuthController(config) {
  const startSession = (res, session) => setSessionCookie(res, signSessionToken(session, config), config);

  return {
    async register(req, res) {
      const { user, session } = await authService.register(req.body, { ip: req.ip });
      startSession(res, session);
      res.status(201).json({ user });
    },

    async login(req, res) {
      const { user, session } = await authService.login(req.body);
      startSession(res, session);
      res.status(200).json({ user });
    },

    logout(_req, res) {
      clearSessionCookie(res, config);
      res.status(204).end();
    },

    async me(req, res) {
      res.status(200).json(await authService.getCurrentSession(req.user));
    },

    async changePassword(req, res) {
      const { user, session } = await authService.changePassword(req.user, req.body, { ip: req.ip });
      startSession(res, session);
      res.status(200).json({ user });
    },
  };
}

module.exports = { createAuthController };
