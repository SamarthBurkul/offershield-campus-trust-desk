/**
 * The signed-in student still has to confirm the emailed code (only when the server requires it).
 * Staff and super-admin accounts are never gated (the server applies the same rule).
 */
export const needsEmailVerification = (user, emailVerificationRequired) =>
  Boolean(user && user.role === 'student' && emailVerificationRequired && user.emailVerified === false)

/** Restricted accounts see only their gate page (verify email, temporary password, pending approval). */
export const isRestricted = (user, emailVerificationRequired) =>
  Boolean(user && (needsEmailVerification(user, emailVerificationRequired) || user.mustChangePassword || user.status === 'pending_approval'))

/** Accounts created with Google only have no password to change. */
export const hasPassword = (user) => !Array.isArray(user?.authMethods) || user.authMethods.includes('password')
