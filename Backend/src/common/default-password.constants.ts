/**
 * The platform-wide default password assigned to every account that is created
 * on someone else's behalf: company staff, school staff, guardian logins and
 * platform-provisioned accounts.
 *
 * It is only a starting credential — the person can change their own password
 * at any time from the account menu, and nothing in the app forces a rotation.
 */
export const DEFAULT_PASSWORD = 'password123';

/** bcrypt cost factor shared by every password-hashing call site. */
export const BCRYPT_ROUNDS = 10;
