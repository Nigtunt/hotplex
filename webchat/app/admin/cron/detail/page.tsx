'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { listCronJobs, updateCronJob, deleteCronJob, triggerCronJob, getCronRunHistory } from '@/lib/api/admin-cron';
import type { CronJob, CronJobInput, TurnStats } from '@/lib/types/admin';
import { InfoRow } from '@/components/admin/info-row';
import { formatDateTime } from '@/lib/format-time';
import { getErrorMessage } from '@/lib/get-error-message';

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function CronDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id') ?? '';

  const [job, setJob] = useState<CronJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Editable fields
  const [schedule, setSchedule] = useState('');
  const [message, setMessage] = useState('');
  const [maxRuns, setMaxRuns] = useState<string>('');
  const [enabled, setEnabled] = useState(true);

  // Action states
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Inline action errors
  const [actionError, setActionError] = useState<string | null>(null);

  // Inline confirmations
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [confirmTrigger, setConfirmTrigger] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // History states
  const [history, setHistory] = useState<TurnStats | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadJob = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setNotFound(false);
      const data = await listCronJobs();
      const found = data.find((j) => j.id === id);
      if (!found) {
        setNotFound(true);
      } else {
        setJob(found);
        setSchedule(found.schedule);
        setMessage(found.message);
        setMaxRuns(found.max_runs != null ? String(found.max_runs) : '');
        setEnabled(found.enabled);
        setHasChanges(false);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load cron job'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadHistory = useCallback(async () => {
    if (!id) return;
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const data = await getCronRunHistory(id);
      setHistory(data);
    } catch (err) {
      setHistoryError(getErrorMessage(err, 'Failed to load run history'));
    } finally {
      setHistoryLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadJob();
    loadHistory();
  }, [loadJob, loadHistory]);

  // Validate schedule format
  useEffect(() => {
    if (!schedule) {
      setScheduleError('Schedule is required');
      return;
    }
    if (!schedule.startsWith('cron:') && !schedule.startsWith('every:') && !schedule.startsWith('at:')) {
      setScheduleError('Schedule expression must begin with "cron:", "every:", or "at:"');
    } else {
      setScheduleError(null);
    }
  }, [schedule]);

  // Track changes
  useEffect(() => {
    if (!job) return;
    const changed =
      schedule !== job.schedule ||
      message !== job.message ||
      maxRuns !== (job.max_runs != null ? String(job.max_runs) : '') ||
      enabled !== job.enabled;
    setHasChanges(changed);
  }, [schedule, message, maxRuns, enabled, job]);

  const handleSave = async () => {
    if (!job || !hasChanges) return;
    try {
      setSaving(true);
      setActionError(null);
      const updates: Partial<CronJobInput> = {};
      if (schedule !== job.schedule) updates.schedule = schedule;
      if (message !== job.message) updates.message = message;
      if (maxRuns !== (job.max_runs != null ? String(job.max_runs) : '')) {
        updates.max_runs = maxRuns ? Number(maxRuns) : undefined;
      }
      if (enabled !== job.enabled) updates.enabled = enabled;
      await updateCronJob(job.id, updates);
      setJob((prev) => (prev ? { ...prev, ...updates } : prev));
      setHasChanges(false);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to update cron job'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!job) return;
    const next = !enabled;
    setConfirmToggle(false);
    try {
      setSaving(true);
      setActionError(null);
      await updateCronJob(job.id, { enabled: next });
      setJob((prev) => (prev ? { ...prev, enabled: next } : prev));
      setEnabled(next);
      setHasChanges(false);
    } catch (err) {
      setActionError(getErrorMessage(err, `Failed to ${next ? 'enable' : 'disable'} cron job`));
    } finally {
      setSaving(false);
    }
  };

  const handleTrigger = async () => {
    if (!job) return;
    setConfirmTrigger(false);
    try {
      setTriggering(true);
      setActionError(null);
      await triggerCronJob(job.id);
      setTimeout(() => {
        loadHistory();
      }, 1000);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to trigger cron job'));
    } finally {
      setTriggering(false);
    }
  };

  const handleDelete = async () => {
    if (!job) return;
    setConfirmDelete(false);
    try {
      setDeleting(true);
      setActionError(null);
      await deleteCronJob(job.id);
      router.push('/admin/cron');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to delete cron job'));
      setDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!id) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link
          href="/admin/cron"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors mb-6"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Cron Jobs
        </Link>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-sm text-[var(--text-faint)]">No cron job ID specified</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link
          href="/admin/cron"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors mb-6"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Cron Jobs
        </Link>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-[var(--accent-gold)] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[var(--text-faint)]">Loading cron job...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link
          href="/admin/cron"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors mb-6"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Cron Jobs
        </Link>
        <div className="rounded-[var(--radius-md)] bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.15)] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--accent-coral)]">{error}</p>
            <button
              onClick={loadJob}
              className="text-xs font-medium text-[var(--accent-coral)] underline underline-offset-2 hover:text-[var(--accent-coral)]/80 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link
          href="/admin/cron"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors mb-6"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Cron Jobs
        </Link>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-10 w-10 text-[var(--text-faint)] mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-sm text-[var(--text-muted)]">Cron job not found</p>
          <p className="text-xs text-[var(--text-faint)] mt-1 font-mono">{id}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Back link */}
      <Link
        href="/admin/cron"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors mb-6"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Cron Jobs
      </Link>

      {/* Action error banner */}
      {actionError && (
        <div className="mb-4 rounded-[var(--radius-md)] bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.15)] p-3 flex items-center justify-between animate-fade-in">
          <p className="text-sm text-[var(--accent-coral)]">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="text-xs font-medium text-[var(--accent-coral)] underline underline-offset-2 hover:text-[var(--accent-coral)]/80 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-display font-bold text-[var(--text-primary)]">
            {job.name}
          </h1>
          {confirmToggle ? (
            <div className="flex items-center gap-1 animate-fade-in">
              <button
                onClick={handleToggle}
                disabled={saving}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  enabled
                    ? 'bg-[var(--accent-coral)] text-white hover:bg-[var(--accent-coral-bright)]'
                    : 'bg-[var(--accent-emerald)] text-black hover:bg-[var(--accent-emerald-bright)]'
                } disabled:opacity-40`}
              >
                {enabled ? 'Disable!' : 'Enable!'}
              </button>
              <button
                onClick={() => setConfirmToggle(false)}
                className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--bg-hover)] text-[var(--text-muted)]"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmToggle(true)}
              disabled={saving}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                enabled
                  ? 'bg-[var(--accent-emerald)]'
                  : 'bg-[var(--text-faint)]/30'
              }`}
              title={enabled ? 'Disable' : 'Enable'}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                  enabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Trigger */}
          {confirmTrigger ? (
            <div className="flex items-center gap-1 animate-fade-in">
              <button
                onClick={handleTrigger}
                disabled={triggering}
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold-bright)] disabled:opacity-40"
              >
                Run!
              </button>
              <button
                onClick={() => setConfirmTrigger(false)}
                className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--bg-hover)] text-[var(--text-muted)]"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmTrigger(true)}
              disabled={triggering || !job.enabled}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-bold uppercase tracking-wider text-[var(--accent-gold)] bg-[var(--accent-gold)]/10 hover:bg-[var(--accent-gold)]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {triggering ? (
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
                </svg>
              )}
              Trigger
            </button>
          )}
          {/* Delete */}
          {confirmDelete ? (
            <div className="flex items-center gap-1 animate-fade-in">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--accent-coral)] text-white hover:bg-[var(--accent-coral-bright)] disabled:opacity-40"
              >
                Del!
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--bg-hover)] text-[var(--text-muted)]"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-bold uppercase tracking-wider text-[var(--accent-coral)] bg-[rgba(244,63,94,0.08)] hover:bg-[rgba(244,63,94,0.15)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? (
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              )}
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Editable fields */}
      <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 mb-4">
        <h2 className="text-xs font-bold text-[var(--text-faint)] uppercase tracking-wider mb-4">Configuration</h2>
        <div className="space-y-4">
          {/* Schedule */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1.5">
              Schedule
            </label>
            <input
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm font-mono text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)]/40"
              placeholder="cron:0 9 * * 1-5"
            />
            {scheduleError && (
              <p className="text-xs text-[var(--accent-coral)] mt-1 font-semibold animate-fade-in">
                {scheduleError}
              </p>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1.5">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)]/40 resize-y"
              placeholder="Task message..."
            />
          </div>

          {/* Max Runs */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1.5">
              Max Runs
            </label>
            <input
              type="number"
              value={maxRuns}
              onChange={(e) => setMaxRuns(e.target.value)}
              min={0}
              className="w-40 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)]/40"
              placeholder="Unlimited"
            />
          </div>

          {/* Save */}
          {hasChanges && (
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !!scheduleError}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-sm)] text-xs font-bold uppercase tracking-wider bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold-bright)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : null}
                Save Changes
              </button>
              <button
                onClick={() => {
                  setSchedule(job.schedule);
                  setMessage(job.message);
                  setMaxRuns(job.max_runs != null ? String(job.max_runs) : '');
                  setEnabled(job.enabled);
                }}
                className="text-xs text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors"
              >
                Discard
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Read-only info cards */}
      <h2 className="text-xs font-bold text-[var(--text-faint)] uppercase tracking-wider mb-3">Details</h2>
      <div className="grid grid-cols-2 gap-3 mb-8">
        <InfoRow label="ID" value={job.id} mono />
        <InfoRow label="Owner ID" value={job.owner_id ?? ''} mono />
        <InfoRow label="Bot ID" value={job.bot_id ?? ''} mono />
        <InfoRow label="Expires At" value={formatDateTime(job.expires_at)} />
        <InfoRow
          label="Run Count"
          value={job.runs_count != null ? `${job.runs_count}${job.max_runs != null ? ` / ${job.max_runs}` : ''}` : ''}
        />
        <InfoRow label="Last Run" value={formatDateTime(job.last_run_at)} />
        <InfoRow label="Next Run" value={job.enabled ? formatDateTime(job.next_run_at) : '—'} />
      </div>

      {/* Execution History Section */}
      <div className="mt-8 border-t border-[var(--border-subtle)] pt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-[var(--text-faint)] uppercase tracking-wider">
            Execution History (Latest Run)
          </h2>
          <button
            onClick={loadHistory}
            disabled={historyLoading}
            className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-gold)] hover:underline transition-all disabled:opacity-40"
          >
            Refresh History
          </button>
        </div>

        {/* History Loading Skeletons */}
        {historyLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse h-16"></div>
              ))}
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="grid grid-cols-[80px_100px_90px_100px_1fr_120px] gap-2 px-4 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-2 w-12 bg-[var(--bg-hover)] rounded"></div>
                ))}
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-[80px_100px_90px_100px_1fr_120px] gap-2 px-4 py-3 border-b border-[var(--border-subtle)] last:border-b-0 animate-pulse">
                  <div className="h-3 w-8 bg-[var(--bg-hover)] rounded"></div>
                  <div className="h-3 w-16 bg-[var(--bg-hover)] rounded"></div>
                  <div className="h-3.5 w-14 bg-[var(--bg-hover)] rounded-full"></div>
                  <div className="h-3 w-10 bg-[var(--bg-hover)] rounded"></div>
                  <div className="h-3 w-28 bg-[var(--bg-hover)] rounded"></div>
                  <div className="h-3 w-12 bg-[var(--bg-hover)] rounded ml-auto"></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History Error */}
        {!historyLoading && historyError && (
          <div className="rounded-[var(--radius-md)] bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.15)] p-4 mb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--accent-coral)]">{historyError}</p>
              <button
                onClick={loadHistory}
                className="text-xs font-medium text-[var(--accent-coral)] underline underline-offset-2 hover:text-[var(--accent-coral)]/80 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* History Empty State */}
        {!historyLoading && !historyError && (!history || !history.turns || history.turns.length === 0) && (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-8 w-8 text-[var(--text-faint)] mb-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <p className="text-sm text-[var(--text-muted)] font-medium">No execution history found for this job yet.</p>
          </div>
        )}

        {/* History Content */}
        {!historyLoading && !historyError && history && history.turns && history.turns.length > 0 && (
          <div className="space-y-4">
            {/* Aggregated stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1">Success Rate</p>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  <span className={history.failed_turns > 0 ? 'text-[var(--accent-coral)]' : 'text-[var(--accent-emerald)]'}>
                    {history.success_turns}
                  </span>
                  <span className="text-[var(--text-muted)] font-normal text-xs"> / {history.total_turns} turns</span>
                </p>
              </div>

              <div className="px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1">Total Duration</p>
                <p className="text-sm font-bold text-[var(--text-primary)]">{history.total_duration_ms}ms</p>
              </div>

              <div className="px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1">Total Cost</p>
                <p className="text-sm font-mono font-bold text-[var(--text-primary)]">${history.total_cost_usd.toFixed(4)}</p>
              </div>

              <div className="px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1">Total Tokens</p>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {history.total_tokens_in + history.total_tokens_out}
                  <span className="text-[var(--text-muted)] font-normal text-xs"> (In: {history.total_tokens_in} / Out: {history.total_tokens_out})</span>
                </p>
              </div>
            </div>

            {/* Turns Table */}
            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[80px_100px_90px_100px_1fr_120px] gap-2 px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Turn</span>
                <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Seq</span>
                <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Status</span>
                <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Duration</span>
                <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Tokens (In / Out / Cache)</span>
                <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase tracking-wider text-right">Cost</span>
              </div>

              {/* Rows */}
              {history.turns.map((turnItem) => (
                <div
                  key={turnItem.seq}
                  className="grid grid-cols-[80px_100px_90px_100px_1fr_120px] gap-2 px-4 py-2 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-hover)] transition-colors items-center"
                >
                  <span className="text-xs font-mono font-medium text-[var(--text-primary)]">
                    #{turnItem.turn_num}
                  </span>

                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    {turnItem.seq}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${
                      turnItem.success ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-coral)]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${turnItem.success ? 'bg-[var(--accent-emerald)]' : 'bg-[var(--accent-coral)]'}`} />
                    {turnItem.success ? 'Success' : 'Failed'}
                  </span>

                  <span className="text-xs text-[var(--text-muted)]">
                    {turnItem.duration_ms}ms
                  </span>

                  <div className="flex flex-col text-[11px] text-[var(--text-muted)] leading-tight">
                    <div>
                      In: <span className="text-[var(--text-primary)] font-mono">{turnItem.tokens_in}</span> / Out: <span className="text-[var(--text-primary)] font-mono">{turnItem.tokens_out}</span>
                    </div>
                    { (turnItem.tokens_cache_read > 0 || turnItem.tokens_cache_write > 0) && (
                      <div className="text-[9px] text-[var(--text-faint)]">
                        Cache: Read {turnItem.tokens_cache_read} / Write {turnItem.tokens_cache_write}
                      </div>
                    )}
                  </div>

                  <span className="text-xs font-mono text-[var(--text-muted)] text-right">
                    ${turnItem.cost_usd.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
