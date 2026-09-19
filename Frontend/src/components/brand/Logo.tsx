import { type SVGProps } from 'react'
import { Box, type BoxProps } from '@mui/material'
import { useColorMode } from '../../contexts/ThemeContext'

interface LogoProps extends BoxProps {
  variant?: 'mark' | 'full'
  size?: number
  height?: number
  mode?: 'light' | 'dark'
}

/**
 * Stylized TG Logo Mark Vector
 */
export function TGMarkIcon({
  size = 40,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id="tg-brand-red" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0066FF" className="tg-gradient-start" style={{ stopColor: '#EC0618' }} />
          <stop offset="100%" stopColor="#0044CC" className="tg-gradient-end" style={{ stopColor: '#B80010' }} />
        </linearGradient>
      </defs>

      {/* Stylized Outer T with dynamic angular cuts & swoop */}
      <path
        d="M2 32.5L26 2H110L94 32.5H48C37.5 32.5 30 39.5 28.5 50V94L48 118H28.5L2 92V32.5Z"
        fill="url(#tg-brand-red)"
      />

      {/* Stylized Nested G with bold inner bar */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M68 28C86.7777 28 102 43.2223 102 62C102 80.7777 86.7777 96 68 96C49.2223 96 34 80.7777 34 62C34 43.2223 49.2223 28 68 28ZM68 44C58.0589 44 50 52.0589 50 62C50 71.9411 58.0589 80 68 80C77.9411 80 86 71.9411 86 62V56H68V44H102V62C102 80.7777 86.7777 96 68 96C49.2223 96 34 80.7777 34 62C34 43.2223 49.2223 28 68 28Z"
        fill="url(#tg-brand-red)"
      />
    </svg>
  )
}

/**
 * Full TGManager Horizontal Brand Vector (TG Mark + Manager Text)
 */
export function TGFullLogo({
  height = 36,
  isDark = true,
  ...props
}: SVGProps<SVGSVGElement> & { height?: number; isDark?: boolean }) {
  const width = Math.round(height * 3.75)
  const textColor = isDark ? '#FFFFFF' : '#0F172A'

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 360 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id="tg-full-brand-red" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EC0618" />
          <stop offset="100%" stopColor="#B80010" />
        </linearGradient>
      </defs>

      {/* ─── TG MARK ─── */}
      <g transform="translate(0, 0)">
        {/* T Component */}
        <path
          d="M2 26L20 2H86L74 26H39C30.5 26 24.5 31.5 23.5 40V75L39 94H23.5L2 73V26Z"
          fill="url(#tg-full-brand-red)"
        />

        {/* G Component nested inside T */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M55 22C70.464 22 83 34.536 83 50C83 65.464 70.464 78 55 78C39.536 78 27 65.464 27 50C27 34.536 39.536 22 55 22ZM55 35C46.7157 35 40 41.7157 40 50C40 58.2843 46.7157 65 55 65C63.2843 65 70 58.2843 70 50V45H55V35H83V50C83 65.464 70.464 78 55 78C39.536 78 27 65.464 27 50C27 34.536 39.536 22 55 22Z"
          fill="url(#tg-full-brand-red)"
        />
      </g>

      {/* ─── "Manager" TYPOGRAPHY ─── */}
      <g transform="translate(88, 0)">
        <text
          x="12"
          y="66"
          fill={textColor}
          fontFamily="Inter, system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="54"
          letterSpacing="-0.035em"
          style={{ transition: 'fill 0.25s ease' }}
        >
          Manager
        </text>
      </g>
    </svg>
  )
}

/**
 * Universal TGManager Logo Component (Adapts to Light/Dark Mode)
 */
export function Logo({
  variant = 'mark',
  size = 40,
  height,
  mode,
  sx,
  ...props
}: LogoProps) {
  const { mode: currentMode } = useColorMode()
  const activeMode = mode || currentMode
  const isDark = activeMode === 'dark'

  if (variant === 'full') {
    const effectiveHeight = height || size
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          lineHeight: 1,
          flexShrink: 0,
          ...sx,
        }}
        {...props}
      >
        <TGFullLogo height={effectiveHeight} isDark={isDark} />
      </Box>
    )
  }

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        flexShrink: 0,
        ...sx,
      }}
      {...props}
    >
      <TGMarkIcon size={size} />
    </Box>
  )
}
