import { createTheme } from '@mui/material/styles'

const redGradient = 'linear-gradient(135deg, #EC0618 0%, #B80010 100%)'
const softRedBg = 'rgba(236, 6, 24, 0.12)'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#EC0618', light: '#FF3344', dark: '#B80010', contrastText: '#FFFFFF' },
    secondary: { main: '#212325', light: '#2D3035', dark: '#17191C', contrastText: '#FFFFFF' },
    info: { main: '#38BDF8', light: '#7DD3FC', dark: '#0284C7' },
    success: { main: '#10B981', light: '#34D399', dark: '#059669' },
    warning: { main: '#F59E0B', light: '#FBBF24', dark: '#D97706' },
    error: { main: '#EC0618', light: '#FF4D5E', dark: '#B80010' },
    background: { default: '#010101', paper: '#212325' },
    divider: '#2D3035',
    text: { primary: '#FFFFFF', secondary: '#8A8F99' },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' },
    h2: { fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' },
    h3: { fontWeight: 800, letterSpacing: '-0.015em', color: '#FFFFFF' },
    h4: { fontWeight: 800, letterSpacing: '-0.01em', color: '#FFFFFF' },
    h5: { fontWeight: 800, letterSpacing: '-0.005em', color: '#FFFFFF' },
    h6: { fontWeight: 800, letterSpacing: 0, color: '#FFFFFF' },
    subtitle1: { fontWeight: 700, color: '#FFFFFF' },
    subtitle2: { fontWeight: 700, color: '#8A8F99' },
    button: { fontWeight: 700, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '::selection': { backgroundColor: 'rgba(236, 6, 24, 0.35)', color: '#FFFFFF' },
        '& *::-webkit-scrollbar': { width: 8, height: 8 },
        '& *::-webkit-scrollbar-thumb': { backgroundColor: '#2D3035', borderRadius: 8, '&:hover': { backgroundColor: '#EC0618' } },
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
          maxWidth: '100%',
          whiteSpace: 'normal',
          textAlign: 'center',
          transition: 'all .2s cubic-bezier(0.4, 0, 0.2, 1)',
          ...(ownerState.variant === 'contained' && ownerState.color === 'primary' && {
            backgroundImage: redGradient,
            boxShadow: '0 8px 24px -6px rgba(236, 6, 24, 0.55)',
            '&:hover': {
              backgroundImage: redGradient,
              boxShadow: '0 12px 28px -6px rgba(236, 6, 24, 0.75)',
              transform: 'translateY(-1px)',
            },
          }),
          ...(ownerState.variant === 'outlined' && ownerState.color === 'primary' && {
            borderColor: 'rgba(236, 6, 24, 0.5)',
            color: '#EC0618',
            '&:hover': {
              borderColor: '#EC0618',
              backgroundColor: 'rgba(236, 6, 24, 0.1)',
            },
          }),
          ...(ownerState.variant === 'text' && ownerState.color === 'primary' && {
            color: '#EC0618',
            '&:hover': { backgroundColor: 'rgba(236, 6, 24, 0.12)' },
          }),
        }),
        sizeLarge: { paddingTop: 14, paddingBottom: 14, paddingLeft: 28, paddingRight: 28 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          border: '1px solid #2D3035',
          boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
          backgroundColor: '#212325',
          transition: 'border-color .2s ease, box-shadow .2s ease, transform .2s ease',
          '&:hover': { borderColor: 'rgba(236, 6, 24, 0.4)', boxShadow: '0 14px 34px -12px rgba(236, 6, 24, 0.25)' },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 22,
          '&:last-child': { paddingBottom: 22 },
          '@media (max-width:599.95px)': {
            padding: 18,
            '&:last-child': { paddingBottom: 18 },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundColor: '#212325', backgroundImage: 'none' },
        rounded: { borderRadius: 20 },
        outlined: { borderRadius: 20, borderColor: '#2D3035', backgroundImage: 'none' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: '#17191C',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2D3035' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#454950' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#EC0618', borderWidth: 2 },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: { input: { color: '#FFFFFF', '&::placeholder': { color: '#8A8F99', opacity: 0.8 } } },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 12, fontWeight: 700 },
        colorPrimary: { backgroundColor: softRedBg, color: '#EC0618', border: '1px solid rgba(236, 6, 24, 0.3)' },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 24, backgroundColor: '#212325', backgroundImage: 'none', border: '1px solid #2D3035', boxShadow: '0 24px 64px rgba(0, 0, 0, 0.75)' } },
    },
    MuiDialogTitle: { styleOverrides: { root: { fontWeight: 800, color: '#FFFFFF' } } },
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
          '& .MuiListItemIcon-root': { color: '#8A8F99' },
          '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
          '&.Mui-selected': {
            backgroundColor: softRedBg,
            color: '#FFFFFF',
            borderLeft: '4px solid #EC0618',
            paddingLeft: 12,
            '& .MuiListItemIcon-root': { color: '#EC0618' },
            '&:hover': { backgroundColor: 'rgba(236, 6, 24, 0.18)' },
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { borderRadius: 8, backgroundColor: '#17191C', border: '1px solid #2D3035', fontWeight: 600 } },
    },
    MuiAvatar: {
      styleOverrides: { root: { backgroundImage: redGradient } },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(16px)',
          backgroundColor: 'rgba(1, 1, 1, 0.85)',
          backgroundImage: 'none',
          borderBottom: '1px solid #2D3035',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          color: '#8A8F99',
          backgroundColor: '#17191C',
          borderBottom: '1px solid #2D3035',
          whiteSpace: 'nowrap',
        },
        body: {
          color: '#FFFFFF',
          borderBottom: '1px solid #2D3035',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': { borderBottom: 0 },
          '&:hover': { backgroundColor: 'rgba(236, 6, 24, 0.04) !important' },
        },
      },
    },
    MuiListSubheader: {
      styleOverrides: { root: { backgroundColor: 'transparent', color: '#8A8F99' } },
    },
  },
})
