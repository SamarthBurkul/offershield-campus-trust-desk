'use strict';

const AppError = require('../utils/AppError');
const google = require('../services/oauth/google');
const googleAuthService = require('../services/googleAuth.service');
const { signSessionToken, setSessionCookie } = require('../utils/jwt');
const { signValue, verifyValue } = require('../utils/signedCookie');
const { googleCallbackQuerySchema } = require('../validators/googleAuth.schemas');

const OAUTH_COOKIE = 'os_oauth';
const SIGNUP_COOKIE = 'os_google_signup';
const COOKIE_PATH = '/api/v1/auth/google';
const COOKIE_TTL_MS = 10 * 60 * 1000;

// Every failure ends on the sign-in page with a fixed code (no detail, no open redirect).
const FAILED = '/login?error=google_failed';
const UNAVAILABLE = '/login?error=account_unavailable';

const notFound = () => new AppError(404, 'NOT_FOUND', 'Route not found');
const noPendingSignup = () => new AppError(401, 'GOOGLE_SIGNUP_EXPIRED', 'Your Google sign-up has expired. Start again with Continue with Google.');

function createGoogleAuthController(config) {
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: COOKIE_PATH };
  const setCookie = (res, name, data) => res.cookie(name, signValue(config, name, data, COOKIE_TTL_MS), { ...cookieOptions, maxAge: COOKIE_TTL_MS });
  const clearCookie = (res, name) => res.clearCookie(name, cookieOptions);
  const readPending = (req) => {
    const data = verifyValue(config, SIGNUP_COOKIE, req.cookies?.[SIGNUP_COOKIE]);
    return data && typeof data.sub === 'string' && typeof data.email === 'string' ? data : null;
  };
  const startSession = (res, session) => setSessionCookie(res, signSessionToken(session, config), config);
  const { clientId, clientSecret, redirectUri } = config.google;

  return {
    /** 404 unless Google sign-in is configured, so the routes do not exist in a Phase 8 setup. */
    requireEnabled(_req, _res, next) {
      if (!config.google.enabled) throw notFound();
      next();
    },

    start(req, res) {
      const { intent } = req.validatedQuery;
      const state = google.randomToken();
      const nonce = google.randomToken();
      const { verifier, challenge } = google.createPkce();
      setCookie(res, OAUTH_COOKIE, { state, nonce, verifier, intent });
      res.redirect(302, google.buildAuthUrl({ clientId, redirectUri, state, nonce, challenge }));
    },

    async callback(req, res) {
      const stored = verifyValue(config, OAUTH_COOKIE, req.cookies?.[OAUTH_COOKIE]);
      clearCookie(res, OAUTH_COOKIE);
      const parsed = googleCallbackQuerySchema.safeParse({ ...req.query });
      if (!parsed.success) return res.redirect(302, FAILED);
      const { code, state, error } = parsed.data;
      if (!stored || error || !code || !state || state !== stored.state) return res.redirect(302, FAILED);

      let identity;
      try {
        const idToken = await google.exchangeCode({ code, verifier: stored.verifier, clientId, clientSecret, redirectUri });
        identity = await google.verifyIdToken(idToken, { clientId, nonce: stored.nonce });
      } catch (err) {
        // Code only: never the authorization code, token or Google's response.
        console.error(`[google] sign-in failed: ${err?.code ?? err?.name ?? 'Error'}`);
        return res.redirect(302, FAILED);
      }

      const outcome = await googleAuthService.resolveGoogleUser(identity, { ip: req.ip });
      if (outcome.kind === 'unavailable') return res.redirect(302, UNAVAILABLE);
      if (outcome.kind === 'failed') return res.redirect(302, FAILED);
      if (outcome.kind === 'session') {
        clearCookie(res, SIGNUP_COOKIE);
        startSession(res, outcome.session);
        return res.redirect(302, outcome.redirect);
      }
      setCookie(res, SIGNUP_COOKIE, { sub: identity.sub, email: identity.email, name: identity.name, hd: identity.hd });
      return res.redirect(302, stored.intent === 'login' ? '/register/google?notice=no_account' : '/register/google');
    },

    pending(req, res) {
      const pending = readPending(req);
      if (!pending) throw noPendingSignup();
      res.status(200).json({ email: pending.email, name: pending.name });
    },

    async complete(req, res) {
      const pending = readPending(req);
      if (!pending) throw noPendingSignup();
      const { user, session } = await googleAuthService.completeGoogleRegistration(pending, req.body, { ip: req.ip });
      clearCookie(res, SIGNUP_COOKIE);
      startSession(res, session);
      res.status(201).json({ user });
    },
  };
}

module.exports = { createGoogleAuthController, OAUTH_COOKIE, SIGNUP_COOKIE, COOKIE_PATH };
