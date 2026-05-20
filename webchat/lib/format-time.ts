/**
 * Shared time-formatting helpers for admin pages.
 */

/** Relative time for lists: "Just now", "5m ago", "in 30m", etc. */
export function formatRelativeTime(iso?: string): string {
  if (!iso) return '--';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffSec < 0) {
    // Future time
    const futureMs = -diffMs;
    const futureMin = Math.floor(futureMs / 60000);
    const futureHour = Math.floor(futureMs / 3600000);
    if (futureMin < 60) return `in ${futureMin}m`;
    if (futureHour < 24) return `in ${futureHour}h`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Absolute datetime for detail views: "Apr 20, 2026, 2:30:00 PM" */
export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
