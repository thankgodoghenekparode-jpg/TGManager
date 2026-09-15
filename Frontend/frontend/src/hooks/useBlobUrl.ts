import { useEffect, useState } from 'react'

/**
 * Fetches a blob (through axios so the tenant/auth headers are attached) and
 * exposes it as an object URL. Re-fetches when `dep` changes and revokes the
 * URL on cleanup. Returns null while loading, on error, or when `dep` is falsy.
 */
export function useBlobUrl(
  dep: unknown,
  fetcher: () => Promise<Blob>,
): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!dep) {
      setUrl(null)
      return
    }
    let cancelled = false
    let current: string | null = null
    setUrl(null)
    fetcher()
      .then((blob) => {
        if (cancelled) return
        current = URL.createObjectURL(blob)
        setUrl(current)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
      if (current) URL.revokeObjectURL(current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])

  return url
}