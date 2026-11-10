'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createCollegeWithMembers } = require('./helpers/factories');
const { createTenantRepository, TenantScopeError } = require('../src/repositories/tenantRepository');
const { User } = require('../src/models/User');

useTestDatabase();

const users = createTenantRepository(User);

let alpha;
let beta;
beforeEach(async () => {
  alpha = await createCollegeWithMembers('alpha');
  beta = await createCollegeWithMembers('beta');
});

describe('19. tenantRepository', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
    ['malformed id', 'not-an-object-id'],
  ])('throws TenantScopeError when collegeId is %s', (_label, collegeId) => {
    expect(() => users.forTenant(collegeId)).toThrow(TenantScopeError);
  });

  it('find never returns another college even when the filter asks for it', async () => {
    const scoped = users.forTenant(alpha.college._id);

    const all = await scoped.find({});
    const sneaky = await scoped.find({ collegeId: beta.college._id });

    expect(all).toHaveLength(3);
    expect(all.every((user) => String(user.collegeId) === String(alpha.college._id))).toBe(true);
    expect(sneaky.every((user) => String(user.collegeId) === String(alpha.college._id))).toBe(true);
  });

  it("findById and findOne return null for another college's document", async () => {
    const scoped = users.forTenant(alpha.college._id);

    expect(await scoped.findById(beta.officer._id)).toBeNull();
    expect(await scoped.findById('not-an-id')).toBeNull();
    expect(await scoped.findOne({ email: 'officer@beta.test.edu' })).toBeNull();
    expect((await scoped.findById(alpha.officer._id)).email).toBe('officer@alpha.test.edu');
  });

  it('count only counts the tenant', async () => {
    expect(await users.forTenant(alpha.college._id).count({})).toBe(3);
    expect(await User.countDocuments()).toBe(6);
  });

  it("updateOne and deleteOne cannot touch another college's document", async () => {
    const scoped = users.forTenant(alpha.college._id);

    const update = await scoped.updateOne({ _id: beta.officer._id }, { $set: { name: 'Hacked' } });
    const removal = await scoped.deleteOne({ _id: beta.officer._id });

    expect(update.matchedCount).toBe(0);
    expect(removal.deletedCount).toBe(0);
    expect((await User.findById(beta.officer._id).lean()).name).not.toBe('Hacked');
  });

  it('refuses updates that would move a document to another college', () => {
    const scoped = users.forTenant(alpha.college._id);

    expect(() => scoped.updateOne({ _id: alpha.officer._id }, { $set: { collegeId: beta.college._id } })).toThrow(
      TenantScopeError,
    );
    expect(() => scoped.updateOne({ _id: alpha.officer._id }, { collegeId: beta.college._id })).toThrow(TenantScopeError);
  });

  it('create always stamps the tenant collegeId', async () => {
    const created = await users.forTenant(alpha.college._id).create({
      role: 'placement_officer',
      name: 'Stamped',
      email: 'stamped@alpha.test.edu',
      passwordHash: 'x',
      collegeId: beta.college._id,
    });

    expect(String(created.collegeId)).toBe(String(alpha.college._id));
  });
});

describe('User model tenancy rules', () => {
  it('requires collegeId for college roles and forbids it for super_admin', async () => {
    await expect(User.create({ role: 'tpo_head', name: 'N', email: 'n@x.edu', passwordHash: 'x' })).rejects.toThrow(
      /collegeId/,
    );
    await expect(
      User.create({ role: 'super_admin', name: 'N', email: 'root2@x.edu', passwordHash: 'x', collegeId: alpha.college._id }),
    ).rejects.toThrow(/collegeId/);
  });

  it("requires a student's branch to be one of the college's branches", async () => {
    await expect(
      User.create({ role: 'student', name: 'S', email: 's@alpha.test.edu', passwordHash: 'x', collegeId: alpha.college._id, year: 1, branch: 'ASTRO' }),
    ).rejects.toThrow(/branch/);
  });
});
