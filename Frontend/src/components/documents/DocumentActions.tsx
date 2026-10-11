import { useState, type ReactNode, type RefObject } from 'react'
import {
  Alert,
  Button,
  CircularProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  type ButtonProps,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import ImageIcon from '@mui/icons-material/Image'
import PrintIcon from '@mui/icons-material/Print'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { downloadNodeAsPdf, downloadNodeAsPng, shareNodeToWhatsApp } from '../../lib/documentExport'

export interface DocumentActionsProps {
  /** Ref to the DOM node that represents the document to export. */
  targetRef: RefObject<HTMLElement | null>
  /** Base filename without extension, e.g. `Report-Card-Chinedu-Eze`. */
  fileBaseName: string
  /** Human-facing document title (PDF metadata + WhatsApp message). */
  title: string
  /** Extra WhatsApp message body (defaults to the title). */
  message?: string
  /** Show the WhatsApp share button (default `true`). */
  whatsapp?: boolean
  /** Share the document as a PNG instead of a PDF. */
  shareAsImage?: boolean
  disabled?: boolean
  size?: ButtonProps['size']
  /** Replace the default "Print" menu item. */
  printHandler?: () => void
  /** Extra actions rendered after the built-in buttons. */
  children?: ReactNode
}

type Task = 'pdf' | 'png' | 'whatsapp' | null

/**
 * A consistent document toolbar: Download (PDF / PNG / Print) + Share to
 * WhatsApp. Attach it to any generated document by pointing `targetRef` at the
 * document node.
 */
export function DocumentActions({
  targetRef,
  fileBaseName,
  title,
  message,
  whatsapp = true,
  shareAsImage = false,
  disabled = false,
  size = 'medium',
  printHandler,
  children,
}: DocumentActionsProps) {
  const [busy, setBusy] = useState<Task>(null)
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [toast, setToast] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null)

  const run = async (task: Exclude<Task, null>, action: () => Promise<void> | void) => {
    if (!targetRef.current) {
      setToast({ severity: 'error', text: 'Nothing to export yet — the document is still loading.' })
      return
    }
    setBusy(task)
    try {
      await action()
    } catch {
      setToast({ severity: 'error', text: 'Sorry, the document could not be generated. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  const handleDownloadPdf = () =>
    run('pdf', async () => {
      if (!targetRef.current) return
      await downloadNodeAsPdf(targetRef.current, fileBaseName)
      setToast({ severity: 'success', text: 'PDF downloaded.' })
    })

  const handleDownloadPng = () =>
    run('png', async () => {
      if (!targetRef.current) return
      await downloadNodeAsPng(targetRef.current, fileBaseName)
      setToast({ severity: 'success', text: 'Image downloaded.' })
    })

  const handleWhatsApp = () =>
    run('whatsapp', async () => {
      if (!targetRef.current) return
      const result = await shareNodeToWhatsApp(targetRef.current, {
        filename: fileBaseName,
        title,
        message,
        preferImage: shareAsImage,
      })
      if (result === 'downloaded') {
        setToast({ severity: 'info', text: 'Document downloaded — attach it in WhatsApp to send.' })
      } else if (result === 'shared') {
        setToast({ severity: 'success', text: 'Shared.' })
      }
    })

  const handlePrint = () => {
    setMenuAnchor(null)
    if (printHandler) {
      printHandler()
      return
    }
    if (!targetRef.current) return
    printElement(targetRef.current)
  }

  const anyBusy = busy !== null

  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
      <Button
        variant="contained"
        size={size}
        disabled={disabled || anyBusy}
        startIcon={busy === 'pdf' || busy === 'png' ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
        onClick={(event) => setMenuAnchor(event.currentTarget)}
      >
        Download
      </Button>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={handleDownloadPdf} disabled={anyBusy}>
          <ListItemIcon><PictureAsPdfIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Download as PDF</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDownloadPng} disabled={anyBusy}>
          <ListItemIcon><ImageIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Download as image (PNG)</ListItemText>
        </MenuItem>
        <MenuItem onClick={handlePrint} disabled={anyBusy}>
          <ListItemIcon><PrintIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Print</ListItemText>
        </MenuItem>
      </Menu>

      {whatsapp ? (
        <Button
          variant="outlined"
          color="success"
          size={size}
          disabled={disabled || anyBusy}
          startIcon={busy === 'whatsapp' ? <CircularProgress size={16} color="inherit" /> : <WhatsAppIcon />}
          onClick={handleWhatsApp}
        >
          WhatsApp
        </Button>
      ) : null}

      {children}

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity ?? 'info'} variant="filled" onClose={() => setToast(null)} sx={{ width: '100%' }}>
          {toast?.text}
        </Alert>
      </Snackbar>
    </Stack>
  )
}

/**
 * Print a single DOM node in isolation (everything else on the page is hidden
 * via the `printing-document` body class + `data-print-target` attribute).
 */
export function printElement(node: HTMLElement): void {
  const body = document.body
  body.classList.add('printing-document')
  node.setAttribute('data-print-target', 'true')

  const cleanup = () => {
    body.classList.remove('printing-document')
    node.removeAttribute('data-print-target')
    window.removeEventListener('afterprint', cleanup)
  }

  window.addEventListener('afterprint', cleanup)
  window.print()
  // Safari / some browsers do not fire `afterprint` reliably.
  window.setTimeout(cleanup, 1500)
}
