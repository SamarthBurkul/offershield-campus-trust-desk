import apiClient from './client.js'

/** The signed-in user's own account: profile, verification, sign-in methods and email preferences. */
export async function getAccount() {
  const { data } = await apiClient.get('/account')
  return data.account
}

/** Patch name, year/branch (students) or emailPrefs. Resolves to the updated account. */
export async function updateAccount(changes) {
  const { data } = await apiClient.patch('/account', changes)
  return data.account
}
