'use strict';

const authService = require('../services/auth.service');
const emailVerification = require('../services/emailVerification.service');
const passwordReset = require('../services/passwordReset.service');
const { signSessionToken, setSessionCookie, clearSessionCookie } = require('../utils/jwt');

function createAuthController(config) {
  const startSession = (res, session) => setSessionCookie(res, signSessionToken(session, config), config);

  return {
    async register(req, res) {
      const { user, session } = await authService.register(req.body, { ip: req.ip, config });
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
      const session = await authService.getCurrentSession(req.user);
      // Lets the client decide whether an unverified address must be confirmed before anything else.
      res.status(200).json({ ...session, emailVerificationRequired: Boolean(config.email?.requireVerification) });
    },

    async changePassword(req, res) {
      const { user, session } = await authService.changePassword(req.user, req.body, { ip: req.ip });
      startSession(res, session);
      res.status(200).json({ user });
    },

    async verifyEmail(req, res) {
      const user = await emailVerification.verifyEmail(req.user, req.body, { config, ip: req.ip });
      res.status(200).json({ user });
    },

    async resendVerification(req, res) {
      res.status(200).json(await emailVerification.resendVerification(req.user, { config }));
    },

    // Always the same answer, whether or not the address has an account.
    forgotPassword(req, res) {
      passwordReset.requestReset(req.body);
      res.status(202).json({ message: 'If an account exists for that address, we have sent instructions to it.' });
    },

    async resetPassword(req, res) {
      await passwordReset.resetPassword(req.body, { ip: req.ip });
      res.status(200).json({ message: 'Your password has been changed. Sign in with your new password.' });
    },
  };
}

module.exports = { createAuthController };
