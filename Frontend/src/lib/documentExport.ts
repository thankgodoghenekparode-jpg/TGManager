/**
 * Document export utilities.
 *
 * Turns a rendered DOM "document" (report card, receipt, ID card, ...) into a
 * real PDF / PNG file, and hands it off for download or sharing (WhatsApp /
 * native share sheet).
 *
 * `html2canvas-pro` and `jspdf` are imported lazily so they never bloat the
 * initial application bundle.
 */
import { saveBlob } from './download'

export type CaptureOptions = {
  /** Raster scale for the capture (2 = crisp on retina / high-DPI). */
  scale?: number
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/** Web Share payload with file attachments (Level 2). */
type FileShareData = ShareData & { files: File[] }

/** Capture a DOM node to a canvas at high resolution. */
async function captureNode(node: HTMLElement, options: CaptureOptions = {}): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas-pro')
  return html2canvas(node, {
    scale: options.scale ?? 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: node.scrollWidth,
    windowHeight: node.scrollHeight,
  })
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not render the document image.'))),
      'image/png',
      0.98,
    )
  })
}

function withExtension(name: string, extension: string): string {
  return /\.(pdf|png)$/i.test(name) ? name : `${name}.${extension}`
}

/**
 * Render the element to a paginated A4 PDF. Tall documents (many subjects,
 * long item lists) flow across multiple pages instead of being shrunk to an
 * unreadable size on a single page.
 */
export async function renderNodeToPdfBlob(node: HTMLElement, options: CaptureOptions = {}): Promise<Blob> {
  const [{ jsPDF }, canvas] = await Promise.all([import('jspdf'), captureNode(node, options)])

  const landscape = canvas.width > canvas.height * 1.05
  const pdf = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: landscape ? 'landscape' : 'portrait',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 24
  const printableWidth = pageWidth - margin * 2
  const printableHeight = pageHeight - margin * 2

  // Points-per-pixel scale derived from the capture width.
  const pxPerPt = canvas.width / printableWidth
  const pageSliceHeightPx = Math.max(1, Math.floor(printableHeight * pxPerPt))

  const slice = document.createElement('canvas')
  const ctx = slice.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser.')

  slice.width = canvas.width

  let offset = 0
  let page = 0
  while (offset < canvas.height) {
    const sliceHeight = Math.min(pageSliceHeightPx, canvas.height - offset)
    slice.height = sliceHeight
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, slice.width, sliceHeight)
    ctx.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)

    if (page > 0) pdf.addPage()
    pdf.addImage(
      slice.toDataURL('image/png'),
      'PNG',
      margin,
      margin,
      printableWidth,
      sliceHeight / pxPerPt,
    )

    offset += sliceHeight
    page += 1
  }

  return pdf.output('blob')
}

/** Render the element to a PNG image blob. */
export async function renderNodeToPngBlob(node: HTMLElement, options: CaptureOptions = {}): Promise<Blob> {
  return canvasToPngBlob(await captureNode(node, options))
}

/** Download the element as a PDF file. */
export async function downloadNodeAsPdf(
  node: HTMLElement,
  filename: string,
  options: CaptureOptions = {},
): Promise<void> {
  const blob = await renderNodeToPdfBlob(node, options)
  saveBlob(blob, withExtension(filename, 'pdf'))
}

/** Download the element as a PNG image file. */
export async function downloadNodeAsPng(
  node: HTMLElement,
  filename: string,
  options: CaptureOptions = {},
): Promise<void> {
  const blob = await renderNodeToPngBlob(node, options)
  saveBlob(blob, withExtension(filename, 'png'))
}

export interface WhatsAppShareMeta {
  /** Base filename (no extension) for the generated attachment. */
  filename: string
  /** Share title / document name. */
  title: string
  /** Prefilled message body. */
  message?: string
  /** Share a PNG instead of a PDF (handy for ID cards / quick previews). */
  preferImage?: boolean
}

/**
 * Share the rendered document to WhatsApp.
 *
 * Preferred path: the Web Share API with a real file attachment (mobile
 * Chrome/Safari and modern desktop open the OS share sheet, from which the
 * user picks WhatsApp). Fallback: download the file and open WhatsApp Web with
 * a prefilled message so the user can attach it in one tap.
 */
export async function shareNodeToWhatsApp(
  node: HTMLElement,
  meta: WhatsAppShareMeta,
  options: CaptureOptions = {},
): Promise<ShareResult> {
  const asImage = meta.preferImage === true
  const blob = asImage
    ? await renderNodeToPngBlob(node, options)
    : await renderNodeToPdfBlob(node, options)
  const extension = asImage ? 'png' : 'pdf'
  const fileName = withExtension(meta.filename, extension)
  const file = new File([blob], fileName, {
    type: asImage ? 'image/png' : 'application/pdf',
  })

  const text = meta.message ?? meta.title
  const nav = navigator as Navigator & { canShare?: (data: FileShareData) => boolean }
  const shareData: FileShareData = { files: [file], title: meta.title, text }

  if (typeof nav.share === 'function' && nav.canShare?.(shareData)) {
    try {
      await nav.share(shareData)
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // Fall through to the download + WhatsApp Web fallback.
    }
  }

  saveBlob(blob, fileName)
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
  return 'downloaded'
}

const MIME_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/zip': 'zip',
}

/** Ensure a title has a sensible file extension, derived from its MIME type. */
export function filenameWithExtension(title: string, mimeType?: string | null): string {
  if (/\.(pdf|png|jpe?g|webp|gif|docx?|xlsx?|csv|txt|zip)$/i.test(title)) return title
  const extension = mimeType ? MIME_EXTENSION[mimeType] : undefined
  return extension ? `${title}.${extension}` : title
}

export interface BlobShareMeta {
  /** Filename (with extension) for the shared attachment. */
  filename: string
  /** Share title / document name. */
  title: string
  /** Prefilled WhatsApp message body. */
  message?: string
}

/**
 * Share an already-fetched file (e.g. an uploaded document) to WhatsApp, using
 * the same native-share-then-fallback strategy as `shareNodeToWhatsApp`.
 */
export async function shareBlobToWhatsApp(blob: Blob, meta: BlobShareMeta): Promise<ShareResult> {
  const type = blob.type || 'application/octet-stream'
  const file = new File([blob], meta.filename, { type })
  const text = meta.message ?? meta.title
  const nav = navigator as Navigator & { canShare?: (data: FileShareData) => boolean }
  const shareData: FileShareData = { files: [file], title: meta.title, text }

  if (typeof nav.share === 'function' && nav.canShare?.(shareData)) {
    try {
      await nav.share(shareData)
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }

  saveBlob(blob, meta.filename)
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  return 'downloaded'
}
