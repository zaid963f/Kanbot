import { getLocale, translate } from '../i18n';
import type { Todo } from '../types/api';

// "2026-11-02" has no time, so we read it as local midnight (otherwise it is UTC and can show the wrong day).
function toDate(value: string) {
  return value.length === 10 ? new Date(value + 'T00:00:00') : new Date(value);
}

// Date -> "2026-11-02"
function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// "2026-11-02" -> "Nov 2"
export function formatDate(value: string | null) {
  if (!value) return '';
  return toDate(value).toLocaleDateString(getLocale(), { month: 'short', day: 'numeric' });
}

// "Oct 20 – Nov 2"
export function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return translate('date.none');
  return `${formatDate(start) || '?'} – ${formatDate(end) || '?'}`;
}

export function daysLeft(end: string | null) {
  if (!end) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((toDate(end).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return translate('date.overdue');
  if (days === 0) return translate('date.endsToday');
  return translate('date.daysLeft', { count: days });
}

export function today() {
  return toDateString(new Date());
}

export function addDays(value: string, days: number) {
  const date = toDate(value);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

export function sumPoints(todos: Todo[]) {
  let total = 0;
  for (const todo of todos) {
    total += todo.storyPoints ?? 0;
  }
  return total;
}

export function byOrder(a: Todo, b: Todo) {
  return a.order - b.order;
}

// ISO timestamp -> "Nov 4, 10:21 AM"
export function formatDateTime(value: string) {
  return new Date(value).toLocaleString(getLocale(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
