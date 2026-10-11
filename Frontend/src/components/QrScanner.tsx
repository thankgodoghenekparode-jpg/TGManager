import { useEffect, useRef, useState } from 'react';
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode';
import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material';

/**
 * Live camera QR / barcode scanner backed by html5-qrcode.
 * Decodes QR codes plus common 1D barcodes (Code 128, EAN/UPC, etc.),
 * matching the digital ID cards issued to students.
 */
const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.PDF_417,
];

/** Ignore repeat decodes of the same code within this window (ms). */
const DEDUPE_WINDOW_MS = 1500;

interface QrScannerProps {
  onScan: (text: string) => void;
  /** While true, decoded codes are ignored (e.g. during a check-in request). */
  paused?: boolean;
}

function describeCameraError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera permission was denied. Allow camera access for this site, or enter the ID card code manually below.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device. Use the manual entry field below instead.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is unavailable (in use by another app or blocked). Close other apps using the camera, or enter the code manually.';
    case 'SecurityError':
      return 'Camera access requires a secure connection (HTTPS). Use manual entry for now.';
    default:
      return 'Could not start the camera. Use the manual entry field below instead.';
  }
}

export function QrScanner({ onScan, paused = false }: QrScannerProps) {
  const [scannerId] = useState(() => `gate-scanner-${Math.random().toString(36).slice(2, 9)}`);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ text: string; at: number } | null>(null);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let cancelled = false;
    let startTimer: ReturnType<typeof setTimeout> | undefined;

    // Give the dialog transition a moment so the container is fully visible.
    startTimer = setTimeout(async () => {
      const scanner = new Html5Qrcode(scannerId, {
        verbose: false,
        formatsToSupport: SUPPORTED_FORMATS,
        // Use the native BarcodeDetector API when available for faster 1D
        // barcode decoding; html5-qrcode falls back as needed.
        useBarCodeDetectorIfSupported: true,
      });
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            aspectRatio: 4 / 3,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              return {
                width: Math.floor(minEdge * 0.7),
                height: Math.floor(minEdge * 0.45),
              };
            },
          },
          (decodedText) => {
            if (cancelled || paused) return;
            const now = Date.now();
            const last = lastScanRef.current;
            if (last && last.text === decodedText && now - last.at < DEDUPE_WINDOW_MS) {
              return;
            }
            lastScanRef.current = { text: decodedText, at: now };
            onScanRef.current(decodedText);
          },
          () => {
            /* Per-frame decode misses are expected; ignore. */
          },
        );
        if (!cancelled) {
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(describeCameraError(err));
        }
      } finally {
        if (!cancelled) {
          setStarting(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      if (startTimer) clearTimeout(startTimer);
      const scanner = scannerRef.current;
      if (scanner) {
        scannerRef.current = null;
        scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            try {
              scanner.clear();
            } catch {
              /* scanner was never started — nothing to clear */
            }
          });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box
        id={scannerId}
        sx={{
          width: '100%',
          minHeight: 240,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: '#000',
        }}
      />
      {starting && !error && (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 1 }}>
          <CircularProgress size={18} thickness={5} />
          <Typography variant="caption" color="text.secondary">
            Starting camera…
          </Typography>
        </Stack>
      )}
      {error && (
        <Alert severity="warning" sx={{ width: '100%' }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}