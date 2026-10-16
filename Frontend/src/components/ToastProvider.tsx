import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Alert, Snackbar } from '@mui/material'

type ToastSeverity = 'success' | 'error' | 'info' | 'warning'

interface ToastState {
  message: string
  severity: ToastSeverity
}

export interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  warning: (message: string) => void
}

// Default to no-ops so `useToast()` never throws if a screen is rendered
// outside the provider (tests, isolated previews).
const ToastContext = createContext<ToastApi>({
  success: () => undefined,
  error: () => undefined,
  info: () => undefined,
  warning: () => undefined,
})

/** App-wide snackbar used to confirm successful (and failed) user actions. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)

  const show = useCallback((message: string, severity: ToastSeverity) => {
    setToast({ message, severity })
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => show(message, 'success'),
      error: (message) => show(message, 'error'),
      info: (message) => show(message, 'info'),
      warning: (message) => show(message, 'warning'),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast?.severity ?? 'info'}
          variant="filled"
          onClose={() => setToast(null)}
          sx={{ width: '100%' }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  return useContext(ToastContext)
}
