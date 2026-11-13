'use strict';

/**
 * Builds the "Demo Institute of Technology" showcase college through the real services (so indicators,
 * links, signals, events, notifications and audit entries are exactly what the app itself produces),
 * then backdates each step so six weeks of activity look realistic in the queue, timelines and stats.
 */
const mongoose = require('mongoose');
const { College } = require('../../src/models/College');
const { User } = require('../../src/models/User');
const { Case } = require('../../src/models/Case');
const { CaseEvent } = require('../../src/models/CaseEvent');
const { Note } = require('../../src/models/Note');
const { AuditLog } = require('../../src/models/AuditLog');
const { Notification } = require('../../src/models/Notification');
const { Evidence } = require('../../src/models/Evidence');
const { FraudIndicator } = require('../../src/models/FraudIndicator');
const { Recruiter } = require('../../src/models/Recruiter');
const { Advisory } = require('../../src/models/Advisory');
const { Acknowledgement } = require('../../src/models/Acknowledgement');
const { LookupEvent } = require('../../src/models/LookupEvent');
const { BUCKET_NAME } = require('../../src/services/storage.service');
const { hashPassword } = require('../../src/utils/password');
const { normalizeJoinCode } = require('../../src/utils/tokens');
const { toSafeUser } = require('../../src/utils/safeUser');
const { POLICIES_VERSION } = require('../../src/constants/policies');
const { createCaseSchema } = require('../../src/validators/case.schemas');
const { decisionSchema } = require('../../src/validators/staffCase.schemas');
const { createRecruiterSchema } = require('../../src/validators/registry.schemas');
const { createAdvisorySchema } = require('../../src/validators/advisory.schemas');
const caseService = require('../../src/services/case.service');
const staffCaseService = require('../../src/services/staffCase.service');
const decisionService = require('../../src/services/decision.service');
const noteService = require('../../src/services/note.service');
const evidenceService = require('../../src/services/evidence.service');
const recruiterService = require('../../src/services/registry/recruiter.service');
const advisoryService = require('../../src/services/advisory.service');
const lookupService = require('../../src/services/lookup.service');
const data = require('./showcaseData');
const { FILES } = require('./demoFiles');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NO_IP = { ip: null };

// Collections whose dates are backdated after each step (all carry collegeId).
const DATED_MODELS = [User, Case, CaseEvent, Note, AuditLog, Notification, Evidence, FraudIndicator, Recruiter, Advisory, Acknowledgement, LookupEvent];

const isObjectId = (value) => value && value._bsontype === 'ObjectId';

/** Collect $set paths for every Date in [from, to], mapped to target + its offset from `from` (keeps order). */
function remapDates(value, window, path, set) {
  if (value instanceof Date) {
    if (value >= window.from && value <= window.to) set[path] = new Date(window.target.getTime() + (value - window.from));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => remapDates(item, window, `${path}.${index}`, set));
  } else if (value && typeof value === 'object' && !isObjectId(value) && !Buffer.isBuffer(value)) {
    for (const [key, nested] of Object.entries(value)) {
      if (key !== '_id') remapDates(nested, window, path ? `${path}.${key}` : key, set);
    }
  }
}

/**
 * Move everything one step wrote (dates between `from` and now) to the step's target time.
 * Native driver on purpose: seed-only backdating of the demo college, including append-only collections.
 */
async function backdate(collegeId, from, target) {
  const window = { from, to: new Date(Date.now() + 1000), target };
  for (const Model of DATED_MODELS) {
    const docs = await Model.collection
      .find({ collegeId, $or: [{ createdAt: { $gte: from } }, { updatedAt: { $gte: from } }] })
      .toArray();
    for (const doc of docs) {
      const set = {};
      remapDates(doc, window, '', set);
      if (Object.keys(set).length) await Model.collection.updateOne({ _id: doc._id }, { $set: set });
    }
  }
  await mongoose.connection.db
    .collection(`${BUCKET_NAME}.files`)
    .updateMany({ 'metadata.collegeId': { $in: [collegeId, String(collegeId)] }, uploadDate: { $gte: from } }, { $set: { uploadDate: target } });
}

async function createPeople(college, passwordHash, createdAt) {
  const people = {};
  for (const person of [...data.STAFF, ...data.STUDENTS]) {
    const doc = await User.create({
      collegeId: college._id,
      role: person.role,
      name: person.name,
      email: person.email,
      passwordHash,
      mustChangePassword: false,
      emailVerifiedAt: createdAt,
      ...(person.role === 'student' ? { year: person.year, branch: person.branch } : {}),
      policiesAcceptedAt: createdAt,
      policiesVersion: POLICIES_VERSION,
    });
    people[person.key] = toSafeUser(doc);
  }
  return people;
}

function caseStepRunner(ctx, spec, step) {
  const { people, caseIds, config } = ctx;
  const caseId = () => caseIds.get(spec.key);
  const actor = people[step.by];
  const student = people[spec.student];
  switch (step.kind) {
    case 'assign':
      return () => staffCaseService.assignCase(actor, caseId(), people[step.to].id, NO_IP);
    case 'note':
      return () => noteService.addNote(actor, caseId(), { body: step.body }, NO_IP);
    case 'info':
      return () => staffCaseService.requestInfo(actor, caseId(), { message: step.message }, NO_IP);
    case 'staffMessage':
      return () => staffCaseService.sendStaffMessage(actor, caseId(), { body: step.body }, NO_IP);
    case 'reply':
      return () => caseService.addStudentMessage(student, caseId(), { body: step.body }, { ...NO_IP, simhashMaxDistance: config.simhashMaxDistance });
    case 'recommend':
      return () => staffCaseService.recommend(actor, caseId(), { type: step.type, basis: step.basis }, NO_IP);
    case 'evidence':
      return () => evidenceService.uploadEvidence(student, caseId(), step.files.map((kind) => FILES[kind]()), NO_IP);
    case 'reopen':
      return () => decisionService.reopenCase(actor, caseId(), { reason: step.reason }, NO_IP);
    case 'decide':
      return () => {
        const { duplicateOf, ...decision } = step.decision;
        const input = decisionSchema.parse({ ...decision, ...(duplicateOf ? { duplicateOfCaseId: String(caseIds.get(duplicateOf)) } : {}) });
        return decisionService.recordDecision(actor, caseId(), input, NO_IP);
      };
    default:
      throw new Error(`Unknown showcase step: ${step.kind}`);
  }
}

/** Every action of the showcase, each with the moment it should appear to have happened. */
function buildTimeline(ctx, now) {
  const { people, caseIds, recruiterIds, config } = ctx;
  const steps = [];
  const at = (daysAgo, hours = 0) => new Date(now - daysAgo * DAY + hours * HOUR);

  for (const recruiter of data.RECRUITERS) {
    const by = recruiter.status === 'pending' ? people.rahul : people.head;
    const daysAgo = recruiter.status === 'pending' ? 10 : 55;
    steps.push({
      at: at(daysAgo),
      run: async () => {
        const input = createRecruiterSchema.parse({
          companyName: recruiter.companyName,
          domains: recruiter.domains,
          contactEmails: recruiter.contactEmails,
          methods: recruiter.methods,
          evidenceNote: recruiter.evidenceNote,
        });
        const view = await recruiterService.createRecruiter(by, input, config, NO_IP);
        recruiterIds.set(recruiter.key, view.id);
        // Verified for last season and not renewed: lookups report it as expired.
        if (recruiter.status === 'expired') {
          await Recruiter.collection.updateOne(
            { _id: new mongoose.Types.ObjectId(view.id) },
            {
              $set: {
                'verification.verifiedAt': new Date(now - 400 * DAY),
                'verification.expiresAt': new Date(now - 35 * DAY),
                'verification.validForDays': 365,
              },
            },
          );
        }
      },
    });
  }

  for (const spec of data.CASES) {
    const created = at(spec.day);
    steps.push({
      at: created,
      run: async () => {
        const input = createCaseSchema.parse({ ...spec.input, receivedAt: new Date(created - 3 * HOUR), consent: true });
        const view = await caseService.createCase(people[spec.student], input, { ...NO_IP, simhashMaxDistance: config.simhashMaxDistance });
        caseIds.set(spec.key, view.id);
      },
    });
    if (spec.evidence) {
      steps.push({
        at: new Date(created.getTime() + 10 * 60 * 1000),
        run: () => evidenceService.uploadEvidence(people[spec.student], caseIds.get(spec.key), spec.evidence.map((kind) => FILES[kind]()), NO_IP),
      });
    }
    for (const step of spec.steps) steps.push({ at: new Date(created.getTime() + step.h * HOUR), run: caseStepRunner(ctx, spec, step) });
  }

  for (const [kind, advisory] of Object.entries(data.ADVISORIES)) {
    const author = kind === 'published' ? people.head : people.sneha;
    steps.push({
      at: at(advisory.day),
      run: async () => {
        const indicators = await FraudIndicator.find({ collegeId: ctx.collegeId, $or: advisory.indicators }).select('_id').lean();
        const input = createAdvisorySchema.parse({
          title: advisory.title,
          body: advisory.body,
          severity: advisory.severity,
          target: advisory.target,
          indicatorIds: indicators.map((item) => String(item._id)),
          sourceCaseId: String(caseIds.get(advisory.sourceCase)),
        });
        const view = await advisoryService.createDraft(author, input, NO_IP);
        ctx.advisoryIds.set(kind, view.id);
      },
    });
    if (kind === 'published') {
      steps.push({ at: at(advisory.day, 1), run: () => advisoryService.publish(people.head, ctx.advisoryIds.get(kind), NO_IP) });
      advisory.acknowledgedBy.forEach((key, index) => {
        steps.push({ at: at(advisory.day, 3 + index * 7), run: () => advisoryService.acknowledge(people[key], ctx.advisoryIds.get(kind)) });
      });
    }
  }

  for (const [key, q, daysAgo] of data.LOOKUPS) {
    steps.push({ at: at(daysAgo, 2), run: () => lookupService.lookup(people[key], { q }) });
  }

  // Stable chronological order: dependencies (case before its steps) always come first.
  return steps.map((step, index) => ({ ...step, index })).sort((a, b) => a.at - b.at || a.index - b.index);
}

/** Last pieces the services cannot express: read notifications and login times. */
async function finishTouches(ctx, now) {
  // Older notifications have been read; the last two days stay unread.
  await Notification.collection.updateMany(
    { collegeId: ctx.collegeId, createdAt: { $lt: new Date(now - 2 * DAY) } },
    { $set: { readAt: new Date(now - 2 * DAY) } },
  );
  await User.collection.updateMany({ collegeId: ctx.collegeId }, { $set: { createdAt: new Date(now - 60 * DAY), lastLoginAt: new Date(now - DAY) } });
}

/**
 * Create the showcase college if it does not exist yet (idempotent: an existing one is left as is).
 * @returns {Promise<{ created: boolean, college: object, accounts: Array<{ role: string, email: string }> }>}
 */
async function seedShowcase({ demoPassword, config, now = Date.now(), log = () => {} }) {
  const accounts = [...data.STAFF, ...data.STUDENTS].map(({ role, email }) => ({ role, email }));
  const existing = await College.findOne({ code: data.COLLEGE.code }).lean();
  if (existing) {
    log(`  college ${data.COLLEGE.code}: already exists (use --reset to rebuild it)`);
    return { created: false, college: existing, accounts };
  }

  const college = await College.create({
    name: data.COLLEGE.name,
    code: data.COLLEGE.code,
    emailDomains: [data.COLLEGE.domain],
    branches: data.COLLEGE.branches,
    studentVerification: 'email_domain',
    isDemo: true,
    studentJoinCodeHash: await hashPassword(normalizeJoinCode(data.COLLEGE.joinCode)),
  });
  const people = await createPeople(college, await hashPassword(demoPassword), new Date(now - 60 * DAY));
  const ctx = { collegeId: college._id, people, config, caseIds: new Map(), recruiterIds: new Map(), advisoryIds: new Map() };

  const timeline = buildTimeline(ctx, now);
  log(`  college ${data.COLLEGE.code}: created; replaying ${timeline.length} steps`);
  for (const step of timeline) {
    const startedAt = new Date();
    await step.run();
    await backdate(college._id, startedAt, step.at);
  }
  await finishTouches(ctx, now);
  return { created: true, college: college.toObject(), accounts };
}

module.exports = { seedShowcase, remapDates, SHOWCASE: data };
