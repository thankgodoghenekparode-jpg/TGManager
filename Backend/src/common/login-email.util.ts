/**
 * Helpers for the login emails that are auto-derived when an account is
 * provisioned on someone else's behalf (students, staff, etc.).
 */

/** Lowercase, alphanumeric-only slug suitable for an email local part. */
export function sanitizeEmailLocal(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Builds a login email from a person's ID (admission / employee number) and the
 * tenant slug, e.g.
 *
 *   adm20260007@tgeasy-model-college.students.tgmanager.app
 *
 * The tenant slug is part of the domain because admission and employee numbers
 * restart at 1 in every tenant, so the number alone is not globally unique.
 */
export function derivedLoginEmail(
  localId: string,
  tenantSlug: string | null | undefined,
  kind: 'students' | 'staff',
): string {
  const domain = `${tenantSlug ?? 'school'}.${kind}.tgmanager.app`;
  return `${sanitizeEmailLocal(localId)}@${domain}`;
}
