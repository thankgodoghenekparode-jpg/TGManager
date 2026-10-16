import type { Theme } from '@mui/material/styles';
import type { CbtCategory, CbtExamMode, CbtQuestionSource } from '../../../api/cbt';

/** Colour chip per CBT category so the dashboard reads at a glance. */
export const CATEGORY_COLORS: Record<CbtCategory, string> = {
  JAMB: 'primary',
  WAEC: 'secondary',
  NECO: 'info',
  SCHOOL: 'success',
  MOCK: 'warning',
  GENERAL: 'default',
};

export const SOURCE_COLORS: Record<CbtQuestionSource, string> = {
  SCHOOL: 'success',
  TGMANAGER: 'primary',
  LICENSED: 'info',
  AI: 'warning',
};

export function modeLabel(mode: CbtExamMode): string {
  return mode === 'PRACTICE' ? 'Practice' : 'Mock exam';
}

/** 125 -> "2m 5s", 3725 -> "1h 2m". */
export function formatSeconds(totalSeconds?: number | null): string {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return '—';
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${rest}s`;
  return `${rest}s`;
}

/** Countdown clock: 754 -> "12:34". */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Percentage colour used by score chips across result views. */
export function scoreColor(percentage: number): 'success' | 'warning' | 'error' {
  if (percentage >= 70) return 'success';
  if (percentage >= 50) return 'warning';
  return 'error';
}

export function scoreTone(theme: Theme, percentage: number): string {
  if (percentage >= 70) return theme.palette.success.main;
  if (percentage >= 50) return theme.palette.warning.main;
  return theme.palette.error.main;
}

/** "Ada Obi" initial for avatars. */
export function initials(first?: string, last?: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}
