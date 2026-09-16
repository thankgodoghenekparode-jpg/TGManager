import emailjs from '@emailjs/browser'

export const emailjsConfig = {
  serviceId: (import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined) ?? '',
  publicKey: (import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined) ?? '',
  templateEmailChange:
    (import.meta.env.VITE_EMAILJS_TEMPLATE_EMAIL_CHANGE as string | undefined) ?? '',
  templatePasswordReset:
    (import.meta.env.VITE_EMAILJS_TEMPLATE_PASSWORD_RESET as string | undefined) ?? '',
  superAdminEmail:
    (import.meta.env.VITE_SUPER_ADMIN_EMAIL as string | undefined) ?? '',
}

/**
 * Notifies the super admin (via EmailJS) that a customer created a request.
 *
 * This is a best-effort, purely informative notification. The database is the
 * source of truth and never depends on the email being delivered: if EmailJS
 * is not configured or fails, we do nothing but log, and the request remains
 * PENDING for the admin to review in the dashboard.
 */
export async function notifySuperAdmin({
  template,
  params,
}: {
  template: 'emailChange' | 'passwordReset'
  params: Record<string, string>
}): Promise<boolean> {
  const { serviceId, publicKey } = emailjsConfig
  if (!serviceId || !publicKey) {
    // eslint-disable-next-line no-console
    console.warn('[emailjs] Not configured; admin notification skipped.')
    return false
  }
  const templateId =
    template === 'emailChange'
      ? emailjsConfig.templateEmailChange
      : emailjsConfig.templatePasswordReset
  if (!templateId) {
    // eslint-disable-next-line no-console
    console.warn('[emailjs] Template not configured; admin notification skipped.')
    return false
  }
  try {
    await emailjs.send(serviceId, templateId, params, { publicKey })
    return true
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[emailjs] Admin notification failed:', err)
    return false
  }
}

/**
 * Template params shared by both admin notifications.
 */
export function superAdminParams(extra: Record<string, string>) {
  return {
    to_email: emailjsConfig.superAdminEmail,
    date: new Date().toLocaleString(),
    ...extra,
  }
}
