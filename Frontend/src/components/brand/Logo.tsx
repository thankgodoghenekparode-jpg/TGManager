import { Box, type BoxProps } from '@mui/material'
import { useColorMode } from '../../contexts/ThemeContext'
import logoLight from '../../assets/logo-light.png'
import logoDark from '../../assets/logo-dark.png'
import logoMark from '../../assets/logo-mark.png'

export interface LogoProps extends Omit<BoxProps, 'height'> {
  variant?: 'mark' | 'full'
  size?: number | string
  height?: number | string
  mode?: 'light' | 'dark'
}

/**
 * Universal TGManager Logo Component
 * - Preserves the exact original brand imagery without altering dimensions or colors.
 * - Dynamically adapts the "Manager" text between Dark (pure crisp white) and Light (pure black) modes.
 * - Displays the isolated crimson mark when variant="mark".
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
    const effectiveHeight = height || size || 36
    const src = isDark ? logoDark : logoLight

    return (
      <Box
        component="img"
        src={src}
        alt="TGManager"
        sx={{
          display: 'block',
          height: effectiveHeight,
          width: 'auto',
          objectFit: 'contain',
          userSelect: 'none',
          pointerEvents: 'none',
          transition: 'opacity 0.2s ease',
          ...sx,
        }}
        {...props}
      />
    )
  }

  const markSize = size || height || 36

  return (
    <Box
      component="img"
      src={logoMark}
      alt="TG"
      sx={{
        display: 'block',
        height: markSize,
        width: 'auto',
        objectFit: 'contain',
        userSelect: 'none',
        pointerEvents: 'none',
        ...sx,
      }}
      {...props}
    />
  )
}

/**
 * Backwards-compatible aliases for legacy imports
 */
export const TGMarkIcon = ({ size = 40, ...props }: { size?: number | string } & Omit<BoxProps, 'height'>) => (
  <Logo variant="mark" size={size} {...props} />
)

export const TGFullLogo = ({ height = 36, isDark = true, ...props }: { height?: number | string; isDark?: boolean } & Omit<BoxProps, 'height'>) => (
  <Logo variant="full" height={height} mode={isDark ? 'dark' : 'light'} {...props} />
)

