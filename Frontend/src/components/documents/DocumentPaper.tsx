import { type ReactNode, type Ref } from 'react'
import { Box, Stack, Typography } from '@mui/material'

const INK = '#0f172a'
const MUTED = '#64748b'
const HAIRLINE = '#e2e8f0'

/** The brand accent strip shown at the top of every document. */
function AccentBar() {
  return (
    <Box
      aria-hidden
      sx={{
        height: 6,
        background: 'linear-gradient(90deg, #0ea5e9 0%, #2563eb 48%, #7c3aed 100%)',
      }}
    />
  )
}

export interface DocumentPaperProps {
  children: ReactNode
  /** Faint diagonal watermark text (e.g. tenant name or "PAID"). */
  watermark?: string
  /** Rendered as a `className` on the sheet (used by the print styles). */
  className?: string
  id?: string
  sx?: object
  ref?: Ref<HTMLDivElement>
}

/**
 * A modern A4-style sheet shared by every generated document: white paper,
 * hairline border, soft elevation and a brand accent strip. Print-safe.
 */
export function DocumentPaper({ children, watermark, className, id, sx, ref }: DocumentPaperProps) {
  return (
    <Box
      id={id}
      ref={ref}
      className={className}
      sx={{
        position: 'relative',
        bgcolor: '#ffffff',
        color: INK,
        borderRadius: 3,
        overflow: 'hidden',
        border: `1px solid ${HAIRLINE}`,
        boxShadow: '0 12px 34px -18px rgba(15, 23, 42, 0.35)',
        ...sx,
      }}
    >
      <AccentBar />
      <Box sx={{ position: 'relative', p: { xs: 2.5, sm: 4 } }}>
        {watermark ? (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              opacity: 0.045,
              fontSize: { xs: '2.5rem', sm: '4rem' },
              fontWeight: 900,
              letterSpacing: 6,
              textTransform: 'uppercase',
              transform: 'rotate(-18deg)',
              color: INK,
              whiteSpace: 'nowrap',
            }}
          >
            {watermark}
          </Box>
        ) : null}
        <Box sx={{ position: 'relative' }}>{children}</Box>
      </Box>
    </Box>
  )
}

export interface DocumentHeaderProps {
  logoSrc?: string | null
  /** Fallback icon shown when there is no logo. */
  icon?: ReactNode
  orgName: string
  /** Document title, e.g. "Official Payment Receipt". */
  title: string
  /** Optional organisation tagline / motto. */
  subtitle?: string
  /** Address / contact lines shown under the name. */
  meta?: string[]
  /** Right-aligned block: references, dates, status. */
  right?: ReactNode
}

/** Modern document masthead: brand mark, organisation identity and title. */
export function DocumentHeader({
  logoSrc,
  icon,
  orgName,
  title,
  subtitle,
  meta,
  right,
}: DocumentHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      justifyContent="space-between"
      sx={{ pb: 2, mb: 2.5, borderBottom: `2px solid ${INK}` }}
    >
      <Stack direction="row" spacing={1.75} alignItems="center" sx={{ minWidth: 0 }}>
        <Box
          sx={{
            width: 60,
            height: 60,
            flexShrink: 0,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            background: logoSrc ? '#ffffff' : 'linear-gradient(135deg, #0284c7, #2563eb)',
            border: logoSrc ? `1px solid ${HAIRLINE}` : 'none',
            color: '#ffffff',
            '& img': { width: '100%', height: '100%', objectFit: 'contain', p: 0.5 },
          }}
        >
          {logoSrc ? <img src={logoSrc} alt={orgName} crossOrigin="anonymous" /> : icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 1.15 }}>
            {orgName}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', color: MUTED }}>
              {subtitle}
            </Typography>
          ) : null}
          {meta && meta.length > 0 ? (
            <Typography variant="caption" sx={{ display: 'block', color: MUTED }}>
              {meta.filter(Boolean).join(' • ')}
            </Typography>
          ) : null}
          <Typography
            variant="caption"
            fontWeight={800}
            sx={{ display: 'inline-block', mt: 0.5, px: 0.75, py: 0.15, borderRadius: 0.75, bgcolor: '#eff6ff', color: '#1d4ed8', letterSpacing: 0.6, textTransform: 'uppercase' }}
          >
            {title}
          </Typography>
        </Box>
      </Stack>
      {right ? <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, flexShrink: 0 }}>{right}</Box> : null}
    </Stack>
  )
}

export interface MetaLineProps {
  label: string
  value: ReactNode
  mono?: boolean
}

/** Small label/value pair used inside document meta grids. */
export function MetaLine({ label, value, mono }: MetaLineProps) {
  return (
    <Box>
      <Typography variant="caption" sx={{ display: 'block', color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 10 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700} sx={{ fontFamily: mono ? 'monospace' : undefined }}>
        {value}
      </Typography>
    </Box>
  )
}

export interface DocumentFooterProps {
  /** Label under the signature rule (e.g. "Authorized Bursar Stamp"). */
  signatureLabel?: string
  /** Extra note shown on the left. */
  note?: string
  /** Reference shown next to the generated timestamp. */
  reference?: string
}

/** Closing strip: signature area, verification note and generation stamp. */
export function DocumentFooter({ signatureLabel, note, reference }: DocumentFooterProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
      sx={{ mt: 3, pt: 2, borderTop: `1px dashed ${HAIRLINE}` }}
    >
      <Box>
        {note ? (
          <Typography variant="caption" sx={{ display: 'block', color: MUTED, maxWidth: 340 }}>
            {note}
          </Typography>
        ) : null}
        <Typography variant="caption" sx={{ display: 'block', color: '#94a3b8', mt: 0.5 }}>
          Generated by TGManager{reference ? ` • ${reference}` : ''} • {new Date().toLocaleString()}
        </Typography>
      </Box>
      {signatureLabel ? (
        <Box sx={{ textAlign: 'center', minWidth: 180 }}>
          <Box sx={{ width: '100%', borderBottom: `1px solid ${INK}`, mb: 0.5, height: 22 }} />
          <Typography variant="caption" fontWeight={600}>
            {signatureLabel}
          </Typography>
        </Box>
      ) : null}
    </Stack>
  )
}
