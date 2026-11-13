'use strict';

const accountService = require('../services/account.service');

async function getAccount(req, res) {
  res.status(200).json({ account: await accountService.getAccount(req.user) });
}

async function updateAccount(req, res) {
  res.status(200).json({ account: await accountService.updateAccount(req.user, req.body, { ip: req.ip }) });
}

module.exports = { getAccount, updateAccount };
