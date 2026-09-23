import { createTheme, type Theme } from '@mui/material/styles'

const redGradient = 'linear-gradient(135deg, #EC0618 0%, #B80010 100%)'
const softRedBgDark = 'rgba(236, 6, 24, 0.14)'
const softRedBgLight = 'rgba(236, 6, 24, 0.08)'

export function getAppTheme(mode: 'light' | 'dark' = 'dark'): Theme {
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
      primary: { main: '#EC0618', light: '#FF3344', dark: '#B80010', contrastText: '#FFFFFF' },
      secondary: isDark
        ? { main: '#212325', light: '#2D3035', dark: '#17191C', contrastText: '#FFFFFF' }
        : { main: '#090A0F', light: '#334155', dark: '#020617', contrastText: '#FFFFFF' },
      info: { main: '#0284C7', light: '#38BDF8', dark: '#0369A1' },
      success: { main: '#10B981', light: '#34D399', dark: '#047857' },
      warning: { main: '#F59E0B', light: '#FBBF24', dark: '#B45309' },
      error: { main: '#EC0618', light: '#FF4D5E', dark: '#B80010' },
      background: isDark
        ? { default: '#010101', paper: '#212325' }
        : { default: '#F8FAFC', paper: '#FFFFFF' },
      divider: isDark ? '#2D3035' : '#E2E8F0',
      text: isDark
        ? { primary: '#FFFFFF', secondary: '#94A3B8' }
        : { primary: '#090A0F', secondary: '#334155' },
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: [
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
      h1: { fontWeight: 900, letterSpacing: '-0.03em', color: isDark ? '#FFFFFF' : '#090A0F' },
      h2: { fontWeight: 900, letterSpacing: '-0.025em', color: isDark ? '#FFFFFF' : '#090A0F' },
      h3: { fontWeight: 900, letterSpacing: '-0.02em', color: isDark ? '#FFFFFF' : '#090A0F' },
      h4: { fontWeight: 800, letterSpacing: '-0.015em', color: isDark ? '#FFFFFF' : '#090A0F' },
      h5: { fontWeight: 800, letterSpacing: '-0.01em', color: isDark ? '#FFFFFF' : '#090A0F', fontSize: '1.5rem' },
      h6: { fontWeight: 800, letterSpacing: 0, color: isDark ? '#FFFFFF' : '#090A0F', fontSize: '1.125rem' },
      subtitle1: { fontWeight: 700, color: isDark ? '#FFFFFF' : '#090A0F', fontSize: '1.0625rem' },
      subtitle2: { fontWeight: 700, color: isDark ? '#94A3B8' : '#334155', fontSize: '0.9375rem' },
      body1: { fontWeight: 500, color: isDark ? '#FFFFFF' : '#0F172A', letterSpacing: '-0.005em', fontSize: '1.0625rem' },
      body2: { fontWeight: 500, color: isDark ? '#94A3B8' : '#1E293B', letterSpacing: '-0.005em', fontSize: '0.9375rem' },
      button: { fontWeight: 700, textTransform: 'none', letterSpacing: '0.01em', fontSize: '0.9375rem' },
      caption: { fontWeight: 600, color: isDark ? '#94A3B8' : '#475569', fontSize: '0.8125rem' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            WebkitTextSizeAdjust: '100%',
            textSizeAdjust: '100%',
            fontSize: '16px',
          },
          '::selection': { backgroundColor: 'rgba(236, 6, 24, 0.35)', color: '#FFFFFF' },
          '& *::-webkit-scrollbar': { width: 8, height: 8 },
          '& *::-webkit-scrollbar-thumb': {
            backgroundColor: isDark ? '#2D3035' : '#CBD5E1',
            borderRadius: 8,
            '&:hover': { backgroundColor: '#EC0618' },
          },
          '& *::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: ({ ownerState }) => ({
            borderRadius: 24,
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 22,
            paddingRight: 22,
            minHeight: 44, // 44px mobile touch target ergonomics
            maxWidth: '100%',
            whiteSpace: 'normal',
            textAlign: 'center',
            transition: 'all .2s cubic-bezier(0.4, 0, 0.2, 1)',
            ...(ownerState.variant === 'contained' && ownerState.color === 'primary' && {
              backgroundImage: redGradient,
              color: '#FFFFFF',
              boxShadow: isDark
                ? '0 8px 24px -6px rgba(236, 6, 24, 0.55)'
                : '0 8px 20px -6px rgba(236, 6, 24, 0.45)',
              '&:hover': {
                backgroundImage: redGradient,
                boxShadow: isDark
                  ? '0 12px 28px -6px rgba(236, 6, 24, 0.75)'
                  : '0 12px 26px -6px rgba(236, 6, 24, 0.6)',
                transform: 'translateY(-1px)',
              },
            }),
            ...(ownerState.variant === 'outlined' && ownerState.color === 'primary' && {
              borderColor: isDark ? 'rgba(236, 6, 24, 0.5)' : '#DC2626',
              color: isDark ? '#FF4D5E' : '#B80010',
              fontWeight: 700,
              '&:hover': {
                borderColor: '#EC0618',
                backgroundColor: isDark ? softRedBgDark : softRedBgLight,
              },
            }),
            ...(ownerState.variant === 'text' && ownerState.color === 'primary' && {
              color: isDark ? '#FF4D5E' : '#B80010',
              fontWeight: 700,
              '&:hover': { backgroundColor: isDark ? softRedBgDark : softRedBgLight },
            }),
          }),
          sizeLarge: { paddingTop: 14, paddingBottom: 14, paddingLeft: 28, paddingRight: 28, minHeight: 48 },
          sizeSmall: { minHeight: 36, paddingTop: 6, paddingBottom: 6, paddingLeft: 14, paddingRight: 14 },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 20,
            border: isDark ? '1px solid #2D3035' : '1px solid #E2E8F0',
            boxShadow: isDark
              ? '0 10px 30px -10px rgba(0, 0, 0, 0.5)'
              : '0 4px 20px -4px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)',
            backgroundColor: isDark ? '#212325' : '#FFFFFF',
            transition: 'border-color .2s ease, box-shadow .2s ease, transform .2s ease',
            '&:hover': {
              borderColor: isDark ? 'rgba(236, 6, 24, 0.45)' : 'rgba(236, 6, 24, 0.5)',
              boxShadow: isDark
                ? '0 14px 34px -12px rgba(236, 6, 24, 0.25)'
                : '0 12px 28px -6px rgba(236, 6, 24, 0.14), 0 4px 10px rgba(15, 23, 42, 0.06)',
            },
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: 22,
            '&:last-child': { paddingBottom: 22 },
            '@media (max-width:599.95px)': {
              padding: 16,
              '&:last-child': { paddingBottom: 16 },
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundColor: isDark ? '#212325' : '#FFFFFF', backgroundImage: 'none' },
          rounded: { borderRadius: 20 },
          outlined: {
            borderRadius: 20,
            borderColor: isDark ? '#2D3035' : '#E2E8F0',
            backgroundImage: 'none',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundColor: isDark ? '#17191C' : '#FFFFFF',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? '#2D3035' : '#CBD5E1',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? '#454950' : '#64748B',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#EC0618',
              borderWidth: 2,
            },
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          input: {
            color: isDark ? '#FFFFFF' : '#090A0F',
            fontWeight: 500,
            '&::placeholder': { color: isDark ? '#94A3B8' : '#64748B', opacity: 1 },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 12, fontWeight: 700, fontSize: '0.875rem' },
          colorPrimary: {
            backgroundColor: isDark ? softRedBgDark : softRedBgLight,
            color: isDark ? '#FF6B7A' : '#B80010',
            border: isDark ? '1px solid rgba(236, 6, 24, 0.35)' : '1px solid rgba(236, 6, 24, 0.25)',
          },
          colorSuccess: {
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.12)',
            color: isDark ? '#34D399' : '#047857',
            border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(16, 185, 129, 0.3)',
          },
          colorWarning: {
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.14)' : 'rgba(245, 158, 11, 0.12)',
            color: isDark ? '#FBBF24' : '#9A3412',
            border: isDark ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(245, 158, 11, 0.3)',
          },
          colorInfo: {
            backgroundColor: isDark ? 'rgba(56, 189, 248, 0.14)' : 'rgba(2, 132, 199, 0.12)',
            color: isDark ? '#7DD3FC' : '#0369A1',
            border: isDark ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(2, 132, 199, 0.3)',
          },
          colorError: {
            backgroundColor: isDark ? softRedBgDark : softRedBgLight,
            color: isDark ? '#FF6B7A' : '#991B1B',
            border: isDark ? '1px solid rgba(236, 6, 24, 0.35)' : '1px solid rgba(236, 6, 24, 0.3)',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 24,
            backgroundColor: isDark ? '#212325' : '#FFFFFF',
            backgroundImage: 'none',
            border: isDark ? '1px solid #2D3035' : '1px solid #E2E8F0',
            boxShadow: isDark
              ? '0 24px 64px rgba(0, 0, 0, 0.75)'
              : '0 24px 64px rgba(15, 23, 42, 0.16), 0 4px 16px rgba(15, 23, 42, 0.08)',
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { fontWeight: 900, color: isDark ? '#FFFFFF' : '#090A0F', letterSpacing: '-0.015em' },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: 18,
            paddingTop: 8,
            flexWrap: 'wrap',
            gap: 8,
            '& > :not(style) ~ :not(style)': { marginLeft: 0 },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            marginBottom: 4,
            minHeight: 48,
            '& .MuiListItemIcon-root': { color: isDark ? '#94A3B8' : '#475569' },
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)',
            },
            '&.Mui-selected': {
              backgroundColor: isDark ? softRedBgDark : softRedBgLight,
              color: isDark ? '#FFFFFF' : '#B80010',
              fontWeight: 800,
              borderLeft: '4px solid #EC0618',
              paddingLeft: 12,
              '& .MuiListItemIcon-root': { color: '#EC0618' },
              '&:hover': {
                backgroundColor: isDark ? 'rgba(236, 6, 24, 0.2)' : 'rgba(236, 6, 24, 0.14)',
              },
            },
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: 40,
            '& .MuiSvgIcon-root': { fontSize: '1.5rem' },
          },
        },
      },
      MuiListItemText: {
        styleOverrides: {
          primary: { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.35 },
          secondary: { fontSize: '0.8125rem' },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 8,
            backgroundColor: isDark ? '#17191C' : '#090A0F',
            color: '#FFFFFF',
            border: isDark ? '1px solid #2D3035' : 'none',
            fontWeight: 600,
            fontSize: '0.8125rem',
          },
        },
      },
      MuiAvatar: {
        styleOverrides: { root: { backgroundImage: redGradient, color: '#FFFFFF' } },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            padding: 9,
            '& .MuiSvgIcon-root': { fontSize: '1.375rem' },
            '@media (max-width:599.95px)': {
              padding: 10,
              '& .MuiSvgIcon-root': { fontSize: '1.5rem' },
            },
          },
          sizeLarge: { padding: 13, '& .MuiSvgIcon-root': { fontSize: '1.625rem' } },
          sizeSmall: { padding: 5, '& .MuiSvgIcon-root': { fontSize: '1.125rem' } },
        },
      },
      MuiSvgIcon: {
        styleOverrides: {
          fontSizeSmall: { fontSize: '1.125rem' },
          fontSizeMedium: { fontSize: '1.375rem' },
          fontSizeLarge: { fontSize: '1.625rem' },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backdropFilter: 'blur(16px)',
            backgroundColor: isDark ? 'rgba(1, 1, 1, 0.9)' : 'rgba(255, 255, 255, 0.94)',
            backgroundImage: 'none',
            borderBottom: isDark ? '1px solid #2D3035' : '1px solid #E2E8F0',
            color: isDark ? '#FFFFFF' : '#090A0F',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 800,
            fontSize: '0.8125rem',
            letterSpacing: '0.02em',
            color: isDark ? '#94A3B8' : '#090A0F',
            backgroundColor: isDark ? '#17191C' : '#F1F5F9',
            borderBottom: isDark ? '1px solid #2D3035' : '1px solid #E2E8F0',
            whiteSpace: 'nowrap',
            paddingTop: 12,
            paddingBottom: 12,
          },
          body: {
            color: isDark ? '#FFFFFF' : '#0F172A',
            fontWeight: 500,
            fontSize: '0.9375rem',
            borderBottom: isDark ? '1px solid #2D3035' : '1px solid #F1F5F9',
            paddingTop: 12,
            paddingBottom: 12,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:last-child td': { borderBottom: 0 },
            '&:hover': {
              backgroundColor: isDark
                ? 'rgba(236, 6, 24, 0.04) !important'
                : 'rgba(236, 6, 24, 0.03) !important',
            },
          },
        },
      },
      MuiListSubheader: {
        styleOverrides: {
          root: { backgroundColor: 'transparent', color: isDark ? '#94A3B8' : '#475569', fontWeight: 800, letterSpacing: '0.04em' },
        },
      },
    },
  })
}

export const theme = getAppTheme('dark')
