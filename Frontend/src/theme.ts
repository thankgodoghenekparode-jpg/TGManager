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
    shape: { borderRadius: 10 },
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
      // Compact, portable scale: everything is expressed in rem so the base
      // html font-size below is the single lever that shrinks the whole app.
      h1: { fontWeight: 800, letterSpacing: '-0.025em', color: isDark ? '#FFFFFF' : '#090A0F', fontSize: '1.6rem' },
      h2: { fontWeight: 800, letterSpacing: '-0.02em', color: isDark ? '#FFFFFF' : '#090A0F', fontSize: '1.35rem' },
      h3: { fontWeight: 700, letterSpacing: '-0.015em', color: isDark ? '#FFFFFF' : '#090A0F', fontSize: '1.15rem' },
      h4: { fontWeight: 700, letterSpacing: '-0.01em', color: isDark ? '#FFFFFF' : '#090A0F', fontSize: '1.05rem' },
      h5: { fontWeight: 700, letterSpacing: '-0.005em', color: isDark ? '#FFFFFF' : '#090A0F', fontSize: '0.95rem' },
      h6: { fontWeight: 700, letterSpacing: 0, color: isDark ? '#FFFFFF' : '#090A0F', fontSize: '0.85rem' },
      subtitle1: { fontWeight: 600, color: isDark ? '#FFFFFF' : '#090A0F', fontSize: '0.85rem', lineHeight: 1.4 },
      subtitle2: { fontWeight: 600, color: isDark ? '#94A3B8' : '#475569', fontSize: '0.775rem', lineHeight: 1.4 },
      body1: { fontWeight: 400, color: isDark ? '#F1F5F9' : '#0F172A', letterSpacing: '-0.003em', fontSize: '0.85rem', lineHeight: 1.5 },
      body2: { fontWeight: 400, color: isDark ? '#94A3B8' : '#334155', letterSpacing: '-0.003em', fontSize: '0.79rem', lineHeight: 1.5 },
      button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em', fontSize: '0.79rem' },
      caption: { fontWeight: 500, color: isDark ? '#94A3B8' : '#64748B', fontSize: '0.725rem', lineHeight: 1.35 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            WebkitTextSizeAdjust: '100%',
            textSizeAdjust: '100%',
            // Base scale for the entire app (all typography/bespoke sizes are
            // rem-based). Steps down further on smaller screens so the UI stays
            // readable yet compact on tablets and phones.
            fontSize: '13.5px',
            '@media (max-width:900px)': { fontSize: '13px' },
            '@media (max-width:600px)': { fontSize: '12.5px' },
          },
          '::selection': { backgroundColor: 'rgba(236, 6, 24, 0.35)', color: '#FFFFFF' },
          '& *::-webkit-scrollbar': { width: 6, height: 6 },
          '& *::-webkit-scrollbar-thumb': {
            backgroundColor: isDark ? '#2D3035' : '#CBD5E1',
            borderRadius: 6,
            '&:hover': { backgroundColor: '#EC0618' },
          },
          '& *::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: ({ ownerState }) => ({
            borderRadius: 8,
            paddingTop: 6,
            paddingBottom: 6,
            paddingLeft: 14,
            paddingRight: 14,
            minHeight: 34,
            fontSize: '0.8125rem',
            fontWeight: 600,
            maxWidth: '100%',
            whiteSpace: 'normal',
            textAlign: 'center',
            transition: 'all .2s cubic-bezier(0.4, 0, 0.2, 1)',
            ...(ownerState.variant === 'contained' && ownerState.color === 'primary' && {
              backgroundImage: redGradient,
              color: '#FFFFFF',
              boxShadow: isDark
                ? '0 4px 14px -4px rgba(236, 6, 24, 0.55)'
                : '0 4px 12px -4px rgba(236, 6, 24, 0.45)',
              '&:hover': {
                backgroundImage: redGradient,
                boxShadow: isDark
                  ? '0 6px 18px -4px rgba(236, 6, 24, 0.75)'
                  : '0 6px 16px -4px rgba(236, 6, 24, 0.6)',
                transform: 'translateY(-1px)',
              },
            }),
            ...(ownerState.variant === 'outlined' && ownerState.color === 'primary' && {
              borderColor: isDark ? 'rgba(236, 6, 24, 0.5)' : '#DC2626',
              color: isDark ? '#FF4D5E' : '#B80010',
              fontWeight: 600,
              '&:hover': {
                borderColor: '#EC0618',
                backgroundColor: isDark ? softRedBgDark : softRedBgLight,
              },
            }),
            ...(ownerState.variant === 'text' && ownerState.color === 'primary' && {
              color: isDark ? '#FF4D5E' : '#B80010',
              fontWeight: 600,
              '&:hover': { backgroundColor: isDark ? softRedBgDark : softRedBgLight },
            }),
          }),
          sizeLarge: { paddingTop: 8, paddingBottom: 8, paddingLeft: 18, paddingRight: 18, minHeight: 40, fontSize: '0.875rem' },
          sizeSmall: { minHeight: 28, paddingTop: 3, paddingBottom: 3, paddingLeft: 10, paddingRight: 10, fontSize: '0.75rem' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: isDark ? '1px solid #2D3035' : '1px solid #E2E8F0',
            boxShadow: isDark
              ? '0 6px 20px -8px rgba(0, 0, 0, 0.4)'
              : '0 2px 10px -2px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)',
            backgroundColor: isDark ? '#212325' : '#FFFFFF',
            transition: 'border-color .2s ease, box-shadow .2s ease, transform .2s ease',
            '&:hover': {
              borderColor: isDark ? 'rgba(236, 6, 24, 0.35)' : 'rgba(236, 6, 24, 0.4)',
              boxShadow: isDark
                ? '0 10px 24px -10px rgba(236, 6, 24, 0.2)'
                : '0 8px 20px -6px rgba(236, 6, 24, 0.12), 0 2px 6px rgba(15, 23, 42, 0.04)',
            },
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: 16,
            '&:last-child': { paddingBottom: 16 },
            '@media (max-width:599.95px)': {
              padding: 12,
              '&:last-child': { paddingBottom: 12 },
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundColor: isDark ? '#212325' : '#FFFFFF', backgroundImage: 'none' },
          rounded: { borderRadius: 12 },
          outlined: {
            borderRadius: 12,
            borderColor: isDark ? '#2D3035' : '#E2E8F0',
            backgroundImage: 'none',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
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
          input: {
            padding: '8px 12px',
            fontSize: '0.85rem',
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          input: {
            color: isDark ? '#FFFFFF' : '#090A0F',
            fontWeight: 400,
            fontSize: '0.85rem',
            '&::placeholder': { color: isDark ? '#94A3B8' : '#64748B', opacity: 1 },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 6, fontWeight: 600, fontSize: '0.75rem', height: 24 },
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
            borderRadius: 14,
            backgroundColor: isDark ? '#212325' : '#FFFFFF',
            backgroundImage: 'none',
            border: isDark ? '1px solid #2D3035' : '1px solid #E2E8F0',
            boxShadow: isDark
              ? '0 20px 50px rgba(0, 0, 0, 0.75)'
              : '0 16px 45px rgba(15, 23, 42, 0.14), 0 3px 12px rgba(15, 23, 42, 0.06)',
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { fontWeight: 800, color: isDark ? '#FFFFFF' : '#090A0F', letterSpacing: '-0.01em', fontSize: '1.05rem', padding: '14px 18px' },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: 12,
            paddingTop: 6,
            flexWrap: 'wrap',
            gap: 6,
            '& > :not(style) ~ :not(style)': { marginLeft: 0 },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            marginBottom: 2,
            minHeight: 36,
            paddingTop: 5,
            paddingBottom: 5,
            paddingLeft: 10,
            paddingRight: 10,
            '& .MuiListItemIcon-root': { color: isDark ? '#94A3B8' : '#475569' },
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)',
            },
            '&.Mui-selected': {
              backgroundColor: isDark ? softRedBgDark : softRedBgLight,
              color: isDark ? '#FFFFFF' : '#B80010',
              fontWeight: 700,
              borderLeft: '3px solid #EC0618',
              paddingLeft: 9,
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
            minWidth: 32,
            '& .MuiSvgIcon-root': { fontSize: '1.15rem' },
          },
        },
      },
      MuiListItemText: {
        styleOverrides: {
          primary: { fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.3 },
          secondary: { fontSize: '0.725rem' },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 6,
            backgroundColor: isDark ? '#17191C' : '#090A0F',
            color: '#FFFFFF',
            border: isDark ? '1px solid #2D3035' : 'none',
            fontWeight: 500,
            fontSize: '0.75rem',
            padding: '4px 8px',
          },
        },
      },
      MuiAvatar: {
        styleOverrides: { root: { backgroundImage: redGradient, color: '#FFFFFF' } },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            padding: 6,
            '& .MuiSvgIcon-root': { fontSize: '1.15rem' },
            '@media (max-width:599.95px)': {
              padding: 7,
              '& .MuiSvgIcon-root': { fontSize: '1.25rem' },
            },
          },
          sizeLarge: { padding: 9, '& .MuiSvgIcon-root': { fontSize: '1.35rem' } },
          sizeSmall: { padding: 4, '& .MuiSvgIcon-root': { fontSize: '1rem' } },
        },
      },
      MuiSvgIcon: {
        styleOverrides: {
          fontSizeSmall: { fontSize: '1rem' },
          fontSizeMedium: { fontSize: '1.15rem' },
          fontSizeLarge: { fontSize: '1.35rem' },
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
            fontWeight: 700,
            fontSize: '0.75rem',
            letterSpacing: '0.02em',
            color: isDark ? '#94A3B8' : '#090A0F',
            backgroundColor: isDark ? '#17191C' : '#F1F5F9',
            borderBottom: isDark ? '1px solid #2D3035' : '1px solid #E2E8F0',
            whiteSpace: 'nowrap',
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 12,
            paddingRight: 12,
          },
          body: {
            color: isDark ? '#FFFFFF' : '#0F172A',
            fontWeight: 400,
            fontSize: '0.8125rem',
            borderBottom: isDark ? '1px solid #2D3035' : '1px solid #F1F5F9',
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 12,
            paddingRight: 12,
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
          root: { backgroundColor: 'transparent', color: isDark ? '#94A3B8' : '#475569', fontWeight: 700, letterSpacing: '0.04em', fontSize: '0.725rem' },
        },
      },
    },
  })
}

export const theme = getAppTheme('dark')
