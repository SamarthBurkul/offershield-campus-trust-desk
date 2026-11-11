'use strict';

const advisoryService = require('../services/advisory.service');

const ip = (req) => ({ ip: req.ip });

module.exports = {
  // Staff
  async listForStaff(req, res) {
    res.status(200).json(await advisoryService.listForStaff(req.user, req.validatedQuery));
  },
  async audienceCount(req, res) {
    res.status(200).json({ audienceCount: await advisoryService.audienceCount(req.user, req.validatedQuery) });
  },
  async getForStaff(req, res) {
    res.status(200).json({ advisory: await advisoryService.getForStaff(req.user, req.params.id) });
  },
  async create(req, res) {
    res.status(201).json({ advisory: await advisoryService.createDraft(req.user, req.body, ip(req)) });
  },
  async update(req, res) {
    res.status(200).json({ advisory: await advisoryService.updateDraft(req.user, req.params.id, req.body, ip(req)) });
  },
  async publish(req, res) {
    res.status(200).json({ advisory: await advisoryService.publish(req.user, req.params.id, ip(req)) });
  },
  async withdraw(req, res) {
    res.status(200).json({ advisory: await advisoryService.withdraw(req.user, req.params.id, req.body, ip(req)) });
  },

  // Students
  async listForStudent(req, res) {
    res.status(200).json({ advisories: await advisoryService.listForStudent(req.user) });
  },
  async getForStudent(req, res) {
    res.status(200).json({ advisory: await advisoryService.getForStudent(req.user, req.params.id) });
  },
  async acknowledge(req, res) {
    res.status(200).json(await advisoryService.acknowledge(req.user, req.params.id));
  },
};
