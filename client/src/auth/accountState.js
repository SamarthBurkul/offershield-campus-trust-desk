/** The signed-in user still has to confirm the emailed code (only when the server requires it). */
export const needsEmailVerification = (user, emailVerificationRequired) =>
  Boolean(user && emailVerificationRequired && user.emailVerified === false)

/** Restricted accounts see only their gate page (verify email, temporary password, pending approval). */
export const isRestricted = (user, emailVerificationRequired) =>
  Boolean(user && (needsEmailVerification(user, emailVerificationRequired) || user.mustChangePassword || user.status === 'pending_approval'))

/** Accounts created with Google only have no password to change. */
export const hasPassword = (user) => !Array.isArray(user?.authMethods) || user.authMethods.includes('password')
