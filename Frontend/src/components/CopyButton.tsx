import { useState } from 'react'
import { IconButton, Tooltip } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'

/**
 * Copies a short string (login email, temporary password, student ID, API key)
 * to the clipboard and briefly confirms with a tick. Falls back to a hidden
 * textarea + `execCommand` for browsers/insecure contexts where the async
 * Clipboard API is unavailable.
 */
export function CopyButton({
  value,
  label = 'Copy',
  size = 'small',
}: {
  value: string
  label?: string
  size?: 'small' | 'medium' | 'large'
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!value) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const el = document.createElement('textarea')
        el.value = value
        el.style.position = 'fixed'
        el.style.opacity = '0'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Tooltip title={copied ? 'Copied!' : label}>
      <IconButton size={size} onClick={() => void copy()} aria-label={label}>
        {copied ? (
          <CheckIcon fontSize="small" color="success" />
        ) : (
          <ContentCopyIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  )
}
