import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { getAppTheme } from '../theme'

export type ColorMode = 'light' | 'dark'

interface ColorModeContextType {
  mode: ColorMode
  toggleColorMode: () => void
  setColorMode: (mode: ColorMode) => void
}

const ColorModeContext = createContext<ColorModeContextType>({
  mode: 'dark',
  toggleColorMode: () => {},
  setColorMode: () => {},
})

export const useColorMode = () => useContext(ColorModeContext)

const STORAGE_KEY = 'tg_theme_mode'

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') {
      return saved
    }
    return 'dark' // Default signature Red & Black Radiance
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
    document.documentElement.setAttribute('data-theme', mode)
    if (mode === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }
  }, [mode])

  const colorMode = useMemo(
    () => ({
      mode,
      toggleColorMode: () => {
        setModeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
      },
      setColorMode: (newMode: ColorMode) => {
        setModeState(newMode)
      },
    }),
    [mode]
  )

  const theme = useMemo(() => getAppTheme(mode), [mode])

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}
