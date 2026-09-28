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
  /**
   * Optional custom image to render instead of the bundled brand (e.g. a
   * tenant's uploaded logo). When provided, `mode`/color mode adaptation is
   * skipped and this URL is used as-is.
   */
  src?: string
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
  src,
  sx,
  ...props
}: LogoProps) {
  const { mode: currentMode } = useColorMode()
  const activeMode = mode || currentMode
  const isDark = activeMode === 'dark'

  if (src) {
    const customHeight = variant === 'full' ? (height || size || 36) : (size || height || 36)
    return (
      <Box
        component="img"
        src={src}
        alt="Company logo"
        sx={{
          display: 'block',
          height: customHeight,
          width: 'auto',
          maxWidth: '100%',
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

