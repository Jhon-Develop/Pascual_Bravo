import { format, parseISO, isValid, startOfDay, endOfDay, differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Date formatting utilities for Spanish (Colombia) locale.
 * Uses date-fns for consistent, timezone-aware formatting.
 */

export const DATE_LOCALE = es;
export const DEFAULT_TIMEZONE = 'America/Bogota';

/**
 * Format a date for display in Spanish (Colombia).
 * @param date - Date object, ISO string, or timestamp
 * @param pattern - date-fns format pattern
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  pattern: string = 'PPP'
): string {
  if (!date) return '—';

  const dateObj = date instanceof Date ? date : new Date(date);

  if (!isValid(dateObj)) return 'Fecha inválida';

  try {
    return format(dateObj, pattern, { locale: DATE_LOCALE });
  } catch {
    return 'Fecha inválida';
  }
}

/**
 * Format a date for short display (e.g., "15 ene 2024").
 */
export function formatDateShort(date: Date | string | number | null | undefined): string {
  return formatDate(date, 'd MMM yyyy');
}

/**
 * Format a date for medium display (e.g., "15 de enero de 2024").
 */
export function formatDateMedium(date: Date | string | number | null | undefined): string {
  return formatDate(date, 'd \'de\' MMMM \'de\' yyyy');
}

/**
 * Format a date for long display with weekday (e.g., "lunes, 15 de enero de 2024").
 */
export function formatDateLong(date: Date | string | number | null | undefined): string {
  return formatDate(date, 'EEEE, d \'de\' MMMM \'de\' yyyy');
}

/**
 * Format a date for relative display (e.g., "hace 2 días", "mañana").
 */
export function formatDateRelative(date: Date | string | number | null | undefined): string {
  if (!date) return '—';

  const dateObj = date instanceof Date ? date : new Date(date);
  if (!isValid(dateObj)) return 'Fecha inválida';

  const now = new Date();
  const today = startOfDay(now);
  const targetDay = startOfDay(dateObj);
  const diffDays = differenceInDays(targetDay, today);

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  if (diffDays === -1) return 'Ayer';
  if (diffDays > 1 && diffDays <= 7) return `En ${diffDays} días`;
  if (diffDays < -1 && diffDays >= -7) return `Hace ${Math.abs(diffDays)} días`;

  return formatDateMedium(dateObj);
}

/**
 * Format a date and time for display.
 */
export function formatDateTime(date: Date | string | number | null | undefined): string {
  return formatDate(date, 'PPP p');
}

/**
 * Format time only.
 */
export function formatTime(date: Date | string | number | null | undefined): string {
  return formatDate(date, 'p');
}

/**
 * Parse an ISO date string safely.
 */
export function parseDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  try {
    const date = parseISO(dateString);
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
}

/**
 * Get start of day for a date (for comparisons).
 */
export function getStartOfDay(date: Date | string | number): Date {
  return startOfDay(date instanceof Date ? date : new Date(date));
}

/**
 * Get end of day for a date.
 */
export function getEndOfDay(date: Date | string | number): Date {
  return endOfDay(date instanceof Date ? date : new Date(date));
}

/**
 * Check if a date is today.
 */
export function isToday(date: Date | string | number): boolean {
  const dateObj = date instanceof Date ? date : new Date(date);
  return differenceInDays(startOfDay(dateObj), startOfDay(new Date())) === 0;
}

/**
 * Check if a date is in the past (before today).
 */
export function isPast(date: Date | string | number): boolean {
  const dateObj = date instanceof Date ? date : new Date(date);
  return differenceInDays(startOfDay(dateObj), startOfDay(new Date())) < 0;
}

/**
 * Check if a date is in the future (after today).
 */
export function isFuture(date: Date | string | number): boolean {
  const dateObj = date instanceof Date ? date : new Date(date);
  return differenceInDays(startOfDay(dateObj), startOfDay(new Date())) > 0;
}

/**
 * Format a date for input[type="date"] (YYYY-MM-DD).
 */
export function formatDateForInput(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  const dateObj = date instanceof Date ? date : new Date(date);
  if (!isValid(dateObj)) return '';
  return format(dateObj, 'yyyy-MM-dd');
}

/**
 * Format a date for input[type="datetime-local"] (YYYY-MM-DDTHH:mm).
 */
export function formatDateTimeForInput(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  const dateObj = date instanceof Date ? date : new Date(date);
  if (!isValid(dateObj)) return '';
  return format(dateObj, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Get an array of dates for a date range (inclusive).
 */
export function getDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  let current = startOfDay(start);
  const last = startOfDay(end);

  while (current <= last) {
    dates.push(new Date(current));
    current = addDays(current, 1);
  }

  return dates;
}