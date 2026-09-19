import { IconButton, Tooltip, type IconButtonProps } from '@mui/material'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import { useColorMode } from '../contexts/ThemeContext'

interface ThemeToggleProps extends Omit<IconButtonProps, 'onClick'> {
  showTooltip?: boolean
}

export function ThemeToggle({ showTooltip = true, sx, ...props }: ThemeToggleProps) {
  const { mode, toggleColorMode } = useColorMode()
  const isDark = mode === 'dark'

  const button = (
    <IconButton
      onClick={toggleColorMode}
      color="inherit"
      aria-label={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
      sx={{
        borderRadius: 2.5,
        p: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: isDark ? '#FBBF24' : '#EC0618',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          borderColor: 'rgba(236, 6, 24, 0.45)',
          bgcolor: isDark ? 'rgba(251, 191, 36, 0.08)' : 'rgba(236, 6, 24, 0.08)',
          transform: 'rotate(15deg) scale(1.05)',
        },
        ...sx,
      }}
      {...props}
    >
      {isDark ? (
        <LightModeOutlinedIcon fontSize="small" sx={{ color: '#FBBF24' }} />
      ) : (
        <DarkModeOutlinedIcon fontSize="small" sx={{ color: '#0F172A' }} />
      )}
    </IconButton>
  )

  if (showTooltip) {
    return (
      <Tooltip title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'} arrow>
        {button}
      </Tooltip>
    )
  }

  return button
}
