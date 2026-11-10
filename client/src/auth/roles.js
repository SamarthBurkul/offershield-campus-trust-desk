export const ROLES = Object.freeze({
  STUDENT: 'student',
  PLACEMENT_OFFICER: 'placement_officer',
  TPO_HEAD: 'tpo_head',
  SUPER_ADMIN: 'super_admin',
})

export const STAFF_ROLES = Object.freeze([ROLES.TPO_HEAD, ROLES.PLACEMENT_OFFICER])

export const ROLE_LABELS = Object.freeze({
  student: 'Student',
  placement_officer: 'Placement officer',
  tpo_head: 'TPO head',
  super_admin: 'Super admin',
})

export function homePathForRole(role) {
  if (role === ROLES.STUDENT) return '/student'
  if (STAFF_ROLES.includes(role)) return '/staff'
  if (role === ROLES.SUPER_ADMIN) return '/admin'
  return '/'
}
