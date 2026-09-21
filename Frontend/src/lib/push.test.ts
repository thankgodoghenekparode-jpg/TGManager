import { describe, expect, it } from 'vitest'
import { urlBase64ToUint8Array } from './push'

// Valid VAPID public key from `npx web-push generate-vapid-keys`.
const VAPID_PUBLIC_KEY =
  'BOR0F9mc45i9uNFQgV0EpRGhOJzh9L-ZsvaVGXhaIdCvQnbaPkQsE0LyEFMF8uXUtV-zk3uwkpi--oC4GDBRDFA'

describe('urlBase64ToUint8Array', () => {
  it('decodes a URL-safe base64 string into a byte array', () => {
    const bytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.byteLength).toBeGreaterThan(0)
  })

  it('round-trips back to the original URL-safe base64', () => {
    const bytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    const encoded = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(encoded).toBe(VAPID_PUBLIC_KEY)
  })

  it('accepts padded standard base64 as well (with no padding-tolerant "+" and "/")', () => {
    const padded = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    expect(padded.byteLength).toBe(65)
  })
})