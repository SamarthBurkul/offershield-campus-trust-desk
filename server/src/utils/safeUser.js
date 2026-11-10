'use strict';

const idOf = (value) => (value == null ? null : String(value._id ?? value));

/**
 * The single mapper from a User document to what the API may return.
 * passwordHash and tokenVersion are never included.
 */
function toSafeUser(user) {
  const isStudent = user.role === 'student';
  return {
    id: idOf(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    collegeId: idOf(user.collegeId),
    status: user.status,
    mustChangePassword: Boolean(user.mustChangePassword),
    year: isStudent ? (user.year ?? null) : null,
    branch: isStudent ? (user.branch ?? null) : null,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt ?? null,
  };
}

/** Staff listings expose only identity, role and status. */
function toStaffSummary(user) {
  const { id, name, email, role, status } = toSafeUser(user);
  return { id, name, email, role, status };
}

module.exports = { toSafeUser, toStaffSummary, idOf };
