import { useRef, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Button, Container, Divider, Grid, Stack, Typography } from '@mui/material'
import SchoolIcon from '@mui/icons-material/School'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { DocumentActions } from '../../components/documents/DocumentActions'
import { DocumentFooter, DocumentHeader, DocumentPaper } from '../../components/documents/DocumentPaper'
import { demo, marketing, pricingTiers, rolloutPhases, schoolBenefits, schoolFeatures } from '../../config/marketing'

const INK = '#0f172a'
const MUTED = '#64748b'

export function ForSchoolsPage() {
  const brochureRef = useRef<HTMLDivElement>(null)
  const proposalRef = useRef<HTMLDivElement>(null)

  const contact = `Call/WhatsApp ${marketing.salesPhone} · ${marketing.salesEmail}`

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0b1220', color: '#e2e8f0' }}>
      {/* Top bar */}
      <Box sx={{ borderBottom: '1px solid rgba(148,163,184,0.18)' }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 2 }}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#0ea5e9,#7c3aed)' }}>
                <SchoolIcon sx={{ fontSize: 20, color: '#fff' }} />
              </Box>
              <Typography fontWeight={800} sx={{ letterSpacing: 0.3 }}>
                {marketing.companyName}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button component={RouterLink} to="/login" sx={{ color: '#cbd5e1', fontWeight: 700 }}>
                Sign in
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Hero */}
      <Container maxWidth="lg">
        <Stack spacing={3} sx={{ py: { xs: 6, md: 9 }, textAlign: 'center', alignItems: 'center' }}>
          <Typography
            variant="overline"
            sx={{ color: '#38bdf8', fontWeight: 800, letterSpacing: 2 }}
          >
            FOR SCHOOLS
          </Typography>
          <Typography variant="h2" fontWeight={900} sx={{ fontSize: { xs: '2.1rem', md: '3.2rem' }, lineHeight: 1.1, maxWidth: 820 }}>
            The modern way to run your school
          </Typography>
          <Typography variant="h6" sx={{ color: '#94a3b8', fontWeight: 400, maxWidth: 720, fontSize: { xs: '1.05rem', md: '1.25rem' } }}>
            {marketing.blurb}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
            {demo.enabled ? (
              <Button
                component={RouterLink}
                to="/login?demo=1"
                size="large"
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                sx={{ py: 1.5, px: 3, fontWeight: 800, background: 'linear-gradient(135deg,#0ea5e9,#7c3aed)' }}
              >
                Try the live demo
              </Button>
            ) : null}
            <Button
              component="a"
              href={`mailto:${marketing.salesEmail}?subject=TGManager%20for%20Schools`}
              size="large"
              variant="outlined"
              sx={{ py: 1.5, px: 3, fontWeight: 800, color: '#e2e8f0', borderColor: 'rgba(148,163,184,0.4)' }}
            >
              Book a walkthrough
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            No download needed · Works on any phone or computer
          </Typography>
        </Stack>
      </Container>

      {/* Documents */}
      <Box sx={{ bgcolor: '#eef2f7', color: INK, py: { xs: 5, md: 8 } }}>
        <Container maxWidth="lg">
          <Stack spacing={2} sx={{ mb: 4, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={900} sx={{ color: INK }}>
              Take it with you
            </Typography>
            <Typography sx={{ color: MUTED, maxWidth: 640, mx: 'auto' }}>
              Download the one-page brochure or the full proposal as a PDF, or send it straight to WhatsApp —
              then share it with your proprietor, bursar or management team.
            </Typography>
          </Stack>

          <Stack spacing={6}>
            {/* Brochure */}
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Typography variant="h6" fontWeight={800} sx={{ color: INK }}>
                  1 · One-page brochure
                </Typography>
                <DocumentActions
                  targetRef={brochureRef}
                  fileBaseName="TGManager-for-Schools-Brochure"
                  title={`${marketing.companyName} for Schools — Brochure`}
                  message={`${marketing.companyName} for Schools\n${marketing.tagline}\n${contact}`}
                  size="small"
                />
              </Stack>
              <Box ref={brochureRef}>
                <DocumentPaper className="doc-sheet" watermark={marketing.companyName}>
                  <DocumentHeader
                    icon={<SchoolIcon sx={{ fontSize: 32 }} />}
                    orgName={marketing.companyName}
                    subtitle={marketing.tagline}
                    title="For Schools — Brochure"
                    right={
                      <>
                        <Typography variant="body2" fontWeight={800}>Modern school operations</Typography>
                        <Typography variant="caption" color="text.secondary">{marketing.website}</Typography>
                      </>
                    }
                  />

                  <Typography variant="body2" sx={{ color: INK, mb: 3, fontSize: '1rem' }}>
                    {marketing.blurb}
                  </Typography>

                  <Typography variant="subtitle2" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, color: MUTED, mb: 1.5 }}>
                    Everything your school needs
                  </Typography>
                  <Grid container spacing={2}>
                    {schoolFeatures.map((feature) => (
                      <Grid item xs={12} sm={6} key={feature.title}>
                        <Stack direction="row" spacing={1.25} alignItems="flex-start">
                          <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 20, mt: 0.25 }} />
                          <Box>
                            <Typography variant="body2" fontWeight={800} sx={{ color: INK }}>
                              {feature.title}
                            </Typography>
                            <Typography variant="caption" sx={{ color: MUTED, display: 'block' }}>
                              {feature.description}
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>
                    ))}
                  </Grid>

                  <Divider sx={{ my: 3 }} />

                  <Typography variant="subtitle2" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, color: MUTED, mb: 1.5 }}>
                    Why schools switch
                  </Typography>
                  <Stack spacing={1}>
                    {schoolBenefits.map((benefit) => (
                      <Stack key={benefit} direction="row" spacing={1.25} alignItems="flex-start">
                        <CheckCircleIcon sx={{ color: '#2563eb', fontSize: 18, mt: 0.25 }} />
                        <Typography variant="body2" sx={{ color: INK }}>{benefit}</Typography>
                      </Stack>
                    ))}
                  </Stack>

                  <Divider sx={{ my: 3 }} />

                  <Typography variant="subtitle2" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, color: MUTED, mb: 1.5 }}>
                    Plans
                  </Typography>
                  <Grid container spacing={2}>
                    {pricingTiers.map((tier) => (
                      <Grid item xs={12} sm={4} key={tier.name}>
                        <Box
                          sx={{
                            height: '100%',
                            p: 2,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: tier.highlight ? '#2563eb' : '#e2e8f0',
                            bgcolor: tier.highlight ? '#eff6ff' : '#ffffff',
                          }}
                        >
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography variant="subtitle2" fontWeight={800} sx={{ color: INK }}>{tier.name}</Typography>
                            {tier.highlight ? <WorkspacePremiumIcon sx={{ fontSize: 16, color: '#2563eb' }} /> : null}
                          </Stack>
                          <Typography variant="h6" fontWeight={900} sx={{ color: INK, mt: 0.5 }}>{tier.price}</Typography>
                          {tier.cadence ? (
                            <Typography variant="caption" sx={{ color: MUTED }}>{tier.cadence}</Typography>
                          ) : null}
                          <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                            {tier.features.map((f) => (
                              <Typography key={f} variant="caption" sx={{ color: INK, display: 'block' }}>• {f}</Typography>
                            ))}
                          </Stack>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>

                  <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: '#052e16', color: '#dcfce7' }}>
                    <Typography variant="subtitle2" fontWeight={800}>Free one-term pilot</Typography>
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                      Try TGManager free for a full term. If it doesn’t save your staff hours every week, you pay nothing.
                    </Typography>
                  </Box>

                  <DocumentFooter
                    signatureLabel="Talk to us"
                    note={contact}
                    reference={marketing.website}
                  />
                </DocumentPaper>
              </Box>
            </Stack>

            {/* Proposal */}
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Typography variant="h6" fontWeight={800} sx={{ color: INK }}>
                  2 · Implementation &amp; pilot proposal
                </Typography>
                <DocumentActions
                  targetRef={proposalRef}
                  fileBaseName="TGManager-School-Proposal"
                  title={`${marketing.companyName} — Implementation Proposal`}
                  message={`${marketing.companyName} — Implementation & Pilot Proposal\n${contact}`}
                  size="small"
                />
              </Stack>
              <Box ref={proposalRef}>
                <DocumentPaper className="doc-sheet" watermark="Proposal">
                  <DocumentHeader
                    icon={<SchoolIcon sx={{ fontSize: 32 }} />}
                    orgName={marketing.companyName}
                    subtitle="Implementation & pilot proposal"
                    title="Proposal"
                    right={
                      <>
                        <Typography variant="body2" fontWeight={800}>Prepared for: Your School</Typography>
                        <Typography variant="caption" color="text.secondary">{new Date().toLocaleDateString()}</Typography>
                      </>
                    }
                  />

                  <Section title="1 · Objective">
                    To deploy TGManager across your school so that admissions, attendance, academics, fees and parent
                    communication run on a single, auditable platform — reducing administrative workload and improving
                    fee collection and parent satisfaction.
                  </Section>

                  <Section title="2 · Scope of work">
                    <Stack spacing={0.75}>
                      {[
                        'School workspace setup: classes, arms, subjects, grading scheme and fee structures.',
                        'Staff accounts and role-based permissions (principal, bursar, exams officer, teachers, gate).',
                        'Student and guardian data import; parent portal activation.',
                        'Attendance (biometric and QR gate scan) and timetable configuration.',
                        'Grading workflow, result approval/publishing and term report cards.',
                        'Fees: invoices, part-payment tracking and official receipts.',
                        'Training for administrative staff and a short parent onboarding message.',
                      ].map((item) => (
                        <Stack key={item} direction="row" spacing={1.25} alignItems="flex-start">
                          <CheckCircleIcon sx={{ color: '#2563eb', fontSize: 18, mt: 0.25 }} />
                          <Typography variant="body2" sx={{ color: INK }}>{item}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Section>

                  <Section title="3 · Rollout plan">
                    <Grid container spacing={2}>
                      {rolloutPhases.map((phase) => (
                        <Grid item xs={12} sm={4} key={phase.phase}>
                          <Box sx={{ p: 1.75, borderRadius: 2, border: '1px solid #e2e8f0', height: '100%' }}>
                            <Typography variant="caption" fontWeight={800} sx={{ color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                              {phase.phase}
                            </Typography>
                            <Typography variant="body2" fontWeight={800} sx={{ color: INK }}>{phase.title}</Typography>
                            <Typography variant="caption" sx={{ color: MUTED }}>{phase.detail}</Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Section>

                  <Section title="4 · Training & support">
                    On-site or remote training for the bursar, exams officer and class teachers, plus a guided parent
                    onboarding message. Ongoing support via phone, WhatsApp and email throughout the pilot.
                  </Section>

                  <Section title="5 · Data, security & ownership">
                    <Stack spacing={0.75}>
                      {[
                        'Role-based access control and audit logs for sensitive actions.',
                        'Your data belongs to your school and can be exported on request.',
                        'Secure, encrypted transport and regular backups.',
                      ].map((item) => (
                        <Stack key={item} direction="row" spacing={1.25} alignItems="flex-start">
                          <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 18, mt: 0.25 }} />
                          <Typography variant="body2" sx={{ color: INK }}>{item}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Section>

                  <Section title="6 · Commercials">
                    <Grid container spacing={2}>
                      {pricingTiers.map((tier) => (
                        <Grid item xs={12} sm={4} key={tier.name}>
                          <Box sx={{ p: 1.75, borderRadius: 2, border: '1px solid', borderColor: tier.highlight ? '#2563eb' : '#e2e8f0', bgcolor: tier.highlight ? '#eff6ff' : '#fff', height: '100%' }}>
                            <Typography variant="subtitle2" fontWeight={800} sx={{ color: INK }}>{tier.name}</Typography>
                            <Typography variant="h6" fontWeight={900} sx={{ color: INK }}>{tier.price}</Typography>
                            {tier.cadence ? <Typography variant="caption" sx={{ color: MUTED, display: 'block' }}>{tier.cadence}</Typography> : null}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                    <Typography variant="body2" sx={{ color: INK, mt: 2 }}>
                      <strong>Pilot:</strong> the first term is free. Billing begins the following term, only if you choose to continue.
                    </Typography>
                  </Section>

                  <Section title="7 · Next steps">
                    <Stack spacing={0.5}>
                      <Typography variant="body2" sx={{ color: INK }}>1. Confirm the plan and pilot start date.</Typography>
                      <Typography variant="body2" sx={{ color: INK }}>2. Share your student/staff list and current fee structure.</Typography>
                      <Typography variant="body2" sx={{ color: INK }}>3. We complete setup and training within two weeks and go live in week three.</Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: MUTED, mt: 2 }}>
                      Questions? {contact}
                    </Typography>
                  </Section>

                  <DocumentFooter
                    signatureLabel="Authorized School Signatory"
                    note={`${marketing.companyName} · ${marketing.website}`}
                    reference="Implementation & Pilot Proposal"
                  />
                </DocumentPaper>
              </Box>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Footer */}
      <Container maxWidth="lg">
        <Stack spacing={1} sx={{ py: 5, textAlign: 'center', alignItems: 'center' }}>
          <Typography fontWeight={800}>{marketing.companyName}</Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            {contact}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            © {new Date().getFullYear()} {marketing.companyName}. All rights reserved.
          </Typography>
          <Button component={RouterLink} to="/login" sx={{ color: '#cbd5e1', fontWeight: 700 }}>
            Sign in to your workspace
          </Button>
        </Stack>
      </Container>
    </Box>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="subtitle2" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, color: MUTED, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}
