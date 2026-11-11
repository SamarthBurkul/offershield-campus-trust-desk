'use strict';

const { isValidObjectId } = require('mongoose');
const AppError = require('../../utils/AppError');
const { recruiterRepository, fraudIndicatorRepository, caseRepository } = require('../../repositories');
const { normalizeDomain, normalizeEmail, normalizePhone } = require('../indicators/normalize');
const { isFreeMailDomain } = require('../indicators/freeMailDomains');
const { isSameOrSubdomain } = require('./similarity');
const { refreshOpenCases } = require('../signals/loader');
const { usersById } = require('../staffCase.service');
const audit = require('../audit.service');
const { idOf } = require('../../utils/safeUser');

const DAY_MS = 86_400_000;
const iso = (date) => (date ? new Date(date).toISOString() : null);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isHead = (user) => user.role === 'tpo_head';

const notFound = () => new AppError(404, 'NOT_FOUND', 'Recruiter not found');
const invalidState = (message) => new AppError(409, 'INVALID_STATE', message);

function recordAudit(user, recruiterId, action, metadata, ip) {
  return audit.record({ collegeId: user.collegeId, actor: { id: user.id, role: user.role }, action, entityType: 'recruiter', entityId: recruiterId, metadata, ip });
}

/** Normalise and validate the recruiter's domains and contacts. Throws 400 on any invalid value. */
function normalizeContacts({ domains, contactEmails = [], contactPhones = [] }) {
  const normalizedDomains = [...new Set(domains.map((domain) => normalizeDomain(domain)))];
  if (normalizedDomains.some((domain) => !domain)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request: domains: each must be a valid domain such as company.com');
  }
  if (normalizedDomains.some(isFreeMailDomain)) {
    throw new AppError(400, 'FREE_MAIL_NOT_ALLOWED', 'A free email provider cannot be a recruiter domain');
  }

  const emails = [];
  for (const raw of contactEmails) {
    const email = normalizeEmail(raw);
    if (!email) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request: contactEmails: must be valid email addresses');
    if (isFreeMailDomain(email.domain)) {
      throw new AppError(400, 'FREE_MAIL_NOT_ALLOWED', 'Recruiter contact emails cannot use free email providers such as gmail.com');
    }
    if (!normalizedDomains.some((domain) => isSameOrSubdomain(email.domain, domain))) {
      throw new AppError(400, 'CONTACT_DOMAIN_MISMATCH', `${email.email} must use one of the recruiter's domains`);
    }
    emails.push(email.email);
  }

  const phones = [];
  for (const raw of contactPhones) {
    const phone = normalizePhone(raw);
    if (!phone) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request: contactPhones: must be Indian mobile numbers');
    phones.push(phone);
  }
  return { domains: normalizedDomains, contactEmails: [...new Set(emails)], contactPhones: [...new Set(phones)] };
}

/** A verified recruiter may not use a domain or email that is a confirmed fraud indicator. */
async function assertNoFraudConflict(collegeId, { domains, contactEmails, contactPhones }) {
  const conflicts = await fraudIndicatorRepository.forTenant(collegeId).find(
    {
      status: 'active',
      $or: [
        { type: 'domain', value: { $in: domains } },
        { type: 'email', value: { $in: contactEmails } },
        { type: 'phone', value: { $in: contactPhones } },
      ],
    },
    { lean: true, limit: 1 },
  );
  if (conflicts.length) {
    throw new AppError(
      409,
      'CONFLICTS_WITH_FRAUD_INDICATOR',
      `${conflicts[0].value} is a confirmed fraud indicator in your college registry and cannot belong to a verified recruiter.`,
    );
  }
}

async function findOr404(user, id) {
  if (!isValidObjectId(id)) throw notFound();
  const recruiter = await recruiterRepository.forTenant(user.collegeId).findById(id);
  if (!recruiter) throw notFound();
  return recruiter;
}

function newVerification(user, { methods, evidenceNote, expiresInDays }, config) {
  const days = expiresInDays ?? config.recruiterVerificationDays;
  const now = new Date();
  return isHead(user)
    ? { methods, evidenceNote, verifiedBy: user.id, verifiedAt: now, expiresAt: new Date(now.getTime() + days * DAY_MS), validForDays: days }
    : { methods, evidenceNote, verifiedBy: null, verifiedAt: null, expiresAt: null, validForDays: days };
}

const historyEntry = (verification, user) => ({ ...verification.toObject(), replacedAt: new Date(), replacedBy: user.id });

function toRecruiterView(recruiter, people) {
  const ref = (id) => (id ? { id: String(id), name: people.get(String(id))?.name ?? null } : null);
  const v = recruiter.verification;
  return {
    id: idOf(recruiter._id),
    companyName: recruiter.companyName,
    domains: [...recruiter.domains],
    contactEmails: [...recruiter.contactEmails],
    contactPhones: [...recruiter.contactPhones],
    status: recruiter.status,
    isExpired: recruiter.status === 'verified' && Boolean(v.expiresAt) && new Date(v.expiresAt) < new Date(),
    verification: {
      methods: [...v.methods],
      evidenceNote: v.evidenceNote,
      verifiedBy: ref(v.verifiedBy),
      verifiedAt: iso(v.verifiedAt),
      expiresAt: iso(v.expiresAt),
      validForDays: v.validForDays,
    },
    verificationHistory: (recruiter.verificationHistory ?? []).map((entry) => ({
      methods: [...entry.methods],
      evidenceNote: entry.evidenceNote,
      verifiedBy: ref(entry.verifiedBy),
      verifiedAt: iso(entry.verifiedAt),
      expiresAt: iso(entry.expiresAt),
      replacedAt: iso(entry.replacedAt),
      replacedBy: ref(entry.replacedBy),
    })),
    sourceCaseId: idOf(recruiter.sourceCaseId),
    createdBy: ref(recruiter.createdBy),
    suspendedReason: recruiter.suspendedReason ?? null,
    createdAt: iso(recruiter.createdAt),
    updatedAt: iso(recruiter.updatedAt),
  };
}

async function view(user, recruiter) {
  const v = recruiter.verification;
  const people = await usersById(user.collegeId, [
    recruiter.createdBy,
    v.verifiedBy,
    ...(recruiter.verificationHistory ?? []).flatMap((entry) => [entry.verifiedBy, entry.replacedBy]),
  ]);
  return toRecruiterView(recruiter, people);
}

async function listRecruiters(user, { q, status, page, limit }) {
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const or = [{ companyName: { $regex: escapeRegex(q), $options: 'i' } }];
    const domain = normalizeDomain(q);
    const email = normalizeEmail(q)?.email;
    const phone = normalizePhone(q);
    if (domain) or.push({ domains: domain });
    if (email) or.push({ contactEmails: email });
    if (phone) or.push({ contactPhones: phone });
    filter.$or = or;
  }
  const repo = recruiterRepository.forTenant(user.collegeId);
  const [items, total] = await Promise.all([
    repo.find(filter, { sort: { companyName: 1, _id: 1 }, skip: (page - 1) * limit, limit }),
    repo.count(filter),
  ]);
  const people = await usersById(user.collegeId, items.flatMap((item) => [item.createdBy, item.verification.verifiedBy]));
  return { recruiters: items.map((item) => toRecruiterView(item, people)), page, limit, total };
}

async function createRecruiter(user, input, config, { ip }) {
  const contacts = normalizeContacts(input);
  await assertNoFraudConflict(user.collegeId, contacts);
  if (input.sourceCaseId) {
    const source = isValidObjectId(input.sourceCaseId)
      ? await caseRepository.forTenant(user.collegeId).findById(input.sourceCaseId, { lean: true })
      : null;
    if (!source) throw new AppError(404, 'NOT_FOUND', 'Source case not found');
  }

  const recruiter = await recruiterRepository.forTenant(user.collegeId).create({
    companyName: input.companyName,
    ...contacts,
    // Officers propose; only the TPO head verifies.
    status: isHead(user) ? 'verified' : 'pending_approval',
    verification: newVerification(user, input, config),
    sourceCaseId: input.sourceCaseId ?? null,
    createdBy: user.id,
  });
  await recordAudit(user, recruiter._id, 'recruiter.create', { status: recruiter.status, domainCount: contacts.domains.length }, ip);
  if (recruiter.status === 'verified') await refreshOpenCases(user.collegeId);
  return view(user, recruiter);
}

async function updateRecruiter(user, id, input, config, { ip }) {
  const recruiter = await findOr404(user, id);
  if (!isHead(user) && !(recruiter.status === 'pending_approval' && String(recruiter.createdBy) === user.id)) {
    throw new AppError(403, 'FORBIDDEN', 'Placement officers can only edit pending recruiters they created');
  }

  const merged = {
    domains: input.domains ?? recruiter.domains,
    contactEmails: input.contactEmails ?? recruiter.contactEmails,
    contactPhones: input.contactPhones ?? recruiter.contactPhones,
  };
  const contacts = normalizeContacts(merged);
  await assertNoFraudConflict(user.collegeId, contacts);

  const domainsChanged = input.domains !== undefined && [...contacts.domains].sort().join() !== [...recruiter.domains].sort().join();
  if (recruiter.status === 'verified' && domainsChanged) {
    if (!input.methods || !input.evidenceNote) {
      throw new AppError(400, 'VERIFICATION_REQUIRED', 'Changing the domains of a verified recruiter needs new verification methods and an evidence note');
    }
    recruiter.verificationHistory.push(historyEntry(recruiter.verification, user));
    recruiter.verification = newVerification(user, input, config);
  } else if (input.methods || input.evidenceNote) {
    if (recruiter.status === 'verified') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Use renew to change the verification of a verified recruiter');
    }
    recruiter.verification.methods = input.methods ?? recruiter.verification.methods;
    recruiter.verification.evidenceNote = input.evidenceNote ?? recruiter.verification.evidenceNote;
  }
  if (input.companyName) recruiter.companyName = input.companyName;
  Object.assign(recruiter, contacts);
  await recruiter.save();

  await recordAudit(user, recruiter._id, 'recruiter.update', { fields: Object.keys(input) }, ip);
  await refreshOpenCases(user.collegeId);
  return view(user, recruiter);
}

async function approveRecruiter(user, id, { ip }) {
  const recruiter = await findOr404(user, id);
  if (recruiter.status !== 'pending_approval') throw invalidState('Only pending recruiters can be approved');
  await assertNoFraudConflict(user.collegeId, recruiter);
  const now = new Date();
  const approved = await recruiterRepository.forTenant(user.collegeId).findOneAndUpdate(
    { _id: recruiter._id, status: 'pending_approval' },
    {
      $set: {
        status: 'verified',
        'verification.verifiedBy': user.id,
        'verification.verifiedAt': now,
        'verification.expiresAt': new Date(now.getTime() + recruiter.verification.validForDays * DAY_MS),
      },
    },
  );
  if (!approved) throw invalidState('This recruiter was changed by someone else. Refresh and try again.');
  await recordAudit(user, recruiter._id, 'recruiter.approve', {}, ip);
  await refreshOpenCases(user.collegeId);
  return view(user, approved);
}

async function renewRecruiter(user, id, input, config, { ip }) {
  const recruiter = await findOr404(user, id);
  if (recruiter.status !== 'verified') throw invalidState('Only verified recruiters can be renewed');
  await assertNoFraudConflict(user.collegeId, recruiter);
  recruiter.verificationHistory.push(historyEntry(recruiter.verification, user));
  recruiter.verification = newVerification(user, input, config);
  await recruiter.save();
  await recordAudit(user, recruiter._id, 'recruiter.renew', { methods: input.methods, validForDays: recruiter.verification.validForDays }, ip);
  return view(user, recruiter);
}

async function suspendRecruiter(user, id, { reason }, { ip }) {
  const recruiter = await findOr404(user, id);
  if (recruiter.status === 'suspended') throw invalidState('This recruiter is already suspended');
  const suspended = await recruiterRepository
    .forTenant(user.collegeId)
    .findOneAndUpdate({ _id: recruiter._id, status: recruiter.status }, { $set: { status: 'suspended', suspendedReason: reason } });
  if (!suspended) throw invalidState('This recruiter was changed by someone else. Refresh and try again.');
  await recordAudit(user, recruiter._id, 'recruiter.suspend', { previousStatus: recruiter.status, reasonLength: reason.length }, ip);
  await refreshOpenCases(user.collegeId);
  return view(user, suspended);
}

module.exports = { listRecruiters, createRecruiter, updateRecruiter, approveRecruiter, renewRecruiter, suspendRecruiter };
