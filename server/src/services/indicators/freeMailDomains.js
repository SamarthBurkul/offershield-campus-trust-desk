'use strict';

// Public mailbox providers: their domains say nothing about the recruiter, so they are not domain indicators.
const FREE_MAIL_DOMAINS = Object.freeze(
  new Set([
    'gmail.com',
    'googlemail.com',
    'yahoo.com',
    'yahoo.co.in',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'rediffmail.com',
    'icloud.com',
    'proton.me',
    'protonmail.com',
    'zoho.com',
    'aol.com',
    'gmx.com',
    'yandex.com',
  ]),
);

const isFreeMailDomain = (domain) => FREE_MAIL_DOMAINS.has(domain);

module.exports = { FREE_MAIL_DOMAINS, isFreeMailDomain };
