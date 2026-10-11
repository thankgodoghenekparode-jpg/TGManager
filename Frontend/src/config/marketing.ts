/**
 * Marketing & demo configuration for the public "TGManager for Schools" page
 * and the one-click demo entry point.
 *
 * Everything here can be overridden at build time with Vite env vars so you can
 * point the brochure at your real sales details without touching code:
 *
 *   VITE_SALES_PHONE, VITE_SALES_EMAIL, VITE_WEBSITE, VITE_COMPANY_NAME,
 *   VITE_DEMO_ENABLED, VITE_DEMO_EMAIL, VITE_DEMO_PASSWORD, VITE_DEMO_SCHOOL
 */

const env = import.meta.env as Record<string, string | undefined>

export interface PricingTier {
  name: string
  price: string
  cadence?: string
  highlight?: boolean
  features: string[]
}

export const marketing = {
  companyName: env.VITE_COMPANY_NAME ?? 'TGManager',
  tagline: 'Run your entire school from one place.',
  blurb:
    'Admissions, attendance, timetables, grading, fee collection and parent communication — modernised, in one secure platform built for Nigerian schools.',
  salesPhone: env.VITE_SALES_PHONE ?? '+234 800 000 0000',
  salesEmail: env.VITE_SALES_EMAIL ?? 'sales@tgmanager.com',
  website: env.VITE_WEBSITE ?? 'https://tgmanager.com',
  whatsappNumber: env.VITE_SALES_WHATSAPP ?? '',
} as const

export const demo = {
  enabled: env.VITE_DEMO_ENABLED !== 'false',
  email: env.VITE_DEMO_EMAIL ?? 'principal@tgeasymodel.edu.ng',
  password: env.VITE_DEMO_PASSWORD ?? 'password123',
  schoolName: env.VITE_DEMO_SCHOOL ?? 'TGEasy Model College',
} as const

export const schoolFeatures: { title: string; description: string }[] = [
  { title: 'Admissions & records', description: 'Enrol students, store guardians, medical and academic records in one place.' },
  { title: 'Attendance', description: 'Biometric clock-in plus QR gate scanning, live class registers and daily alerts.' },
  { title: 'Timetable', description: 'Build class and teacher timetables that stay in sync across the school.' },
  { title: 'Grading & report cards', description: 'CA + exam entry, WAEC-standard grades, approval workflow and printable report cards.' },
  { title: 'Fees & receipts', description: 'Invoices, part-payments, balances and instant official receipts for parents.' },
  { title: 'Parent portal', description: 'Parents log in to see results, attendance and fees — no more result-checking queues.' },
  { title: 'Announcements', description: 'Send memos and school news to staff and parents in seconds.' },
  { title: 'Analytics', description: 'Live dashboards for enrolment, collection rate, attendance and performance.' },
]

export const schoolBenefits: string[] = [
  'Cut the hours spent reconciling paper registers and fee books.',
  'Produce term report cards in minutes — and send them to parents on WhatsApp.',
  'Reduce fee leakage with real, audited payment records.',
  'Give parents a login instead of long result-collection queues.',
  'See the whole school’s performance on one dashboard.',
]

export const pricingTiers: PricingTier[] = [
  {
    name: 'Starter',
    price: '₦150',
    cadence: 'per student / term',
    features: ['Admissions & student records', 'Attendance & staff management', 'Announcements', 'Email support'],
  },
  {
    name: 'Standard',
    price: '₦300',
    cadence: 'per student / term',
    highlight: true,
    features: [
      'Everything in Starter',
      'Grading, report cards & class sheets',
      'Fees, invoices & receipts',
      'Parent portal logins',
      'WhatsApp / SMS notifications',
    ],
  },
  {
    name: 'Premium',
    price: 'Custom',
    features: [
      'Everything in Standard',
      'Biometric & QR gate hardware setup',
      'Dedicated onboarding & training',
      'Priority support & data migration',
    ],
  },
]

export const rolloutPhases: { phase: string; title: string; detail: string }[] = [
  { phase: 'Week 1', title: 'Setup & configuration', detail: 'Create your school workspace, classes, subjects, staff accounts, gradings and fee structures.' },
  { phase: 'Week 2', title: 'Data import & training', detail: 'Import students and guardians, then train the bursar, exams officer and class teachers.' },
  { phase: 'Week 3', title: 'Go live', detail: 'Turn on attendance, fee collection and result entry; invite parents to the portal.' },
]
