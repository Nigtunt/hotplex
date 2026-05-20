'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { listCronJobs, updateCronJob, deleteCronJob, triggerCronJob, createCronJob } from '@/lib/api/admin-cron';
import { listBots } from '@/lib/api/admin-bots';
import type { CronJob, BotConfigEntry } from '@/lib/types/admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FilterOption = 'all' | 'enabled' | 'disabled';

function formatTime(iso?: string): string {
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Inline confirmations states
  const [confirmToggle, setConfirmToggle] = useState<string | null>(null);
  const [confirmTrigger, setConfirmTrigger] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Modal creation states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bots, setBots] = useState<BotConfigEntry[]>([]);
  const [modalName, setModalName] = useState('');
  const [modalSchedule, setModalSchedule] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalBotId, setModalBotId] = useState('');
  const [modalOwnerId, setModalOwnerId] = useState('admin');
  const [modalMaxRuns, setModalMaxRuns] = useState('');
  const [modalExpiresAt, setModalExpiresAt] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalScheduleError, setModalScheduleError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listCronJobs();
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cron jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBots = useCallback(async () => {
    try {
      const data = await listBots();
      setBots(data);
      if (data.length > 0) {
        setModalBotId(data[0].bot_id || data[0].name);
      }
    } catch {
      // Ignore silently
    }
  }, []);

  useEffect(() => {
    loadJobs();
    loadBots();
  }, [loadJobs, loadBots]);

  // Validate schedule format in modal
  useEffect(() => {
    if (!modalSchedule) {
      setModalScheduleError(null);
      return;
    }
    if (!modalSchedule.startsWith('cron:') && !modalSchedule.startsWith('every:') && !modalSchedule.startsWith('at:')) {
      setModalScheduleError('Schedule expression must begin with "cron:", "every:", or "at:"');
    } else {
      setModalScheduleError(null);
    }
  }, [modalSchedule]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const filtered = jobs.filter((j) => {
    if (filter === 'all') return true;
    if (filter === 'enabled') return j.enabled;
    return !j.enabled;
  });

  const enabledCount = jobs.filter((j) => j.enabled).length;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const executeToggle = async (job: CronJob) => {
    const next = !job.enabled;
    setConfirmToggle(null);
    try {
      setActionLoading(job.id);
      await updateCronJob(job.id, { enabled: next });
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, enabled: next } : j)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle cron job');
    } finally {
      setActionLoading(null);
    }
  };

  const executeTrigger = async (id: string) => {
    setConfirmTrigger(null);
    try {
      setActionLoading(id);
      await triggerCronJob(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to trigger cron job');
    } finally {
      setActionLoading(null);
    }
  };

  const executeDelete = async (id: string) => {
    setConfirmDelete(null);
    try {
      setActionLoading(id);
      await deleteCronJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete cron job');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalName || !modalSchedule || !modalMessage) {
      setModalError('Please fill out all required fields (Name, Schedule, Message)');
      return;
    }
    if (modalScheduleError) {
      setModalError('Please correct the schedule validation error');
      return;
    }

    try {
      setModalSubmitting(true);
      setModalError(null);

      const jobData: Partial<CronJob> = {
        name: modalName,
        schedule: modalSchedule,
        message: modalMessage,
        bot_id: modalBotId,
        owner_id: modalOwnerId,
        enabled: true,
      };

      if (modalMaxRuns) jobData.max_runs = Number(modalMaxRuns);
      if (modalExpiresAt) jobData.expires_at = modalExpiresAt;

      await createCronJob(jobData);
      
      // Reset form states
      setModalName('');
      setModalSchedule('');
      setModalMessage('');
      setModalMaxRuns('');
      setModalExpiresAt('');
      setModalError(null);
      setIsModalOpen(false);

      // Reload jobs
      loadJobs();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to create cron job');
    } finally {
      setModalSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-display font-bold text-[var(--text-primary)]">
              Cron Jobs
            </h1>
            {!loading && !error && (
              <span className="text-[11px] font-mono text-[var(--text-faint)] px-2 py-0.5 rounded-full bg-[var(--bg-hover)]">
                {enabledCount} enabled / {jobs.length} total
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterOption)}
              className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)]/40"
            >
              <option value="all">All Jobs</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>

            {/* Refresh */}
            <button
              onClick={loadJobs}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
              Refresh
            </button>

            {/* Create Job */}
            <button
              onClick={() => {
                setModalError(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent-gold)] text-black text-[11px] font-bold uppercase tracking-wider hover:bg-[var(--accent-gold-bright)] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Job
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-[var(--radius-md)] bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.15)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--accent-coral)]">{error}</p>
              <button
                onClick={loadJobs}
                className="text-xs font-medium text-[var(--accent-coral)] underline underline-offset-2 hover:text-[var(--accent-coral)]/80 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            {/* Table header skeleton */}
            <div className="grid grid-cols-[1fr_160px_80px_100px_100px_90px_180px] gap-2 px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Name</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Schedule</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Enabled</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Last Run</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Next Run</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Runs</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider text-right">Actions</span>
            </div>

            {/* Table row skeletons */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_160px_80px_100px_100px_90px_180px] gap-2 px-4 py-3 border-b border-[var(--border-subtle)] last:border-b-0 animate-pulse items-center"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="h-3 w-32 bg-[var(--bg-elevated)] rounded"></div>
                  <div className="h-2 w-20 bg-[var(--bg-elevated)] rounded"></div>
                </div>
                <div className="h-3 w-24 bg-[var(--bg-elevated)] rounded"></div>
                <div className="h-4 w-9 bg-[var(--bg-elevated)] rounded-full"></div>
                <div className="h-3 w-16 bg-[var(--bg-elevated)] rounded"></div>
                <div className="h-3 w-16 bg-[var(--bg-elevated)] rounded"></div>
                <div className="h-3 w-10 bg-[var(--bg-elevated)] rounded"></div>
                <div className="flex justify-end gap-1.5">
                  <div className="h-5 w-12 bg-[var(--bg-elevated)] rounded"></div>
                  <div className="h-5 w-14 bg-[var(--bg-elevated)] rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-10 w-10 text-[var(--text-faint)] mb-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
            </svg>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">No cron jobs found</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4 max-w-xs">
              {filter !== 'all' ? `No ${filter} cron jobs found.` : 'No cron jobs have been created on this gateway yet.'}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => {
                  setModalError(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--radius-sm)] bg-[var(--accent-gold)] text-black text-xs font-bold uppercase tracking-wider hover:bg-[var(--accent-gold-bright)] transition-colors"
              >
                Create First Cron Job
              </button>
            )}
          </div>
        )}

        {/* Table */}
        {!loading && !error && filtered.length > 0 && (
          <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_160px_80px_100px_100px_90px_180px] gap-2 px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Name</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Schedule</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Enabled</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Last Run</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Next Run</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Runs</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider text-right">Actions</span>
            </div>

            {/* Table rows */}
            {filtered.map((job) => (
              <div
                key={job.id}
                className={`grid grid-cols-[1fr_160px_80px_100px_100px_90px_180px] gap-2 px-4 py-2.5 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-hover)] transition-colors items-center ${!job.enabled ? 'opacity-60' : ''}`}
              >
                {/* Name */}
                <div className="flex flex-col gap-0.5">
                  <Link
                    href={`/admin/cron/detail?id=${encodeURIComponent(job.id)}`}
                    className="text-xs font-medium text-[var(--accent-gold)] hover:text-[var(--accent-gold-bright)] truncate transition-colors"
                  >
                    {job.name}
                  </Link>
                  {job.message && (
                    <span className="text-[10px] text-[var(--text-faint)] truncate" title={job.message}>
                      {job.message}
                    </span>
                  )}
                </div>

                {/* Schedule */}
                <span className="text-xs font-mono text-[var(--text-muted)] truncate" title={job.schedule}>
                  {job.schedule}
                </span>

                {/* Enabled Toggle */}
                <div>
                  {confirmToggle === job.id ? (
                    <div className="flex items-center gap-1 animate-fade-in">
                      <button
                        onClick={() => executeToggle(job)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          job.enabled
                            ? 'bg-[var(--accent-coral)] text-white hover:bg-[var(--accent-coral-bright)]'
                            : 'bg-[var(--accent-emerald)] text-black hover:bg-[var(--accent-emerald-bright)]'
                        }`}
                      >
                        {job.enabled ? 'Disable!' : 'Enable!'}
                      </button>
                      <button
                        onClick={() => setConfirmToggle(null)}
                        className="px-1 py-0.5 rounded text-[9px] font-bold uppercase bg-[var(--bg-hover)] text-[var(--text-muted)]"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setConfirmToggle(job.id);
                        setConfirmTrigger(null);
                        setConfirmDelete(null);
                      }}
                      disabled={actionLoading === job.id}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        job.enabled
                          ? 'bg-[var(--accent-emerald)]'
                          : 'bg-[var(--text-faint)]/30'
                      }`}
                      title={job.enabled ? 'Disable' : 'Enable'}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                          job.enabled ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  )}
                </div>

                {/* Last run */}
                <span className="text-xs text-[var(--text-muted)]" title={job.last_run_at}>
                  {formatTime(job.last_run_at)}
                </span>

                {/* Next run */}
                <span className="text-xs text-[var(--text-muted)]" title={job.next_run_at}>
                  {job.enabled ? formatTime(job.next_run_at) : '--'}
                </span>

                {/* Runs count / max */}
                <span className="text-xs text-[var(--text-muted)]">
                  {job.runs_count ?? 0}
                  {job.max_runs != null ? <span className="text-[var(--text-faint)]"> / {job.max_runs}</span> : null}
                </span>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1.5 h-7">
                  {/* Trigger */}
                  {confirmTrigger === job.id ? (
                    <div className="flex items-center gap-1 animate-fade-in">
                      <button
                        onClick={() => executeTrigger(job.id)}
                        className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold-bright)]"
                      >
                        Run!
                      </button>
                      <button
                        onClick={() => setConfirmTrigger(null)}
                        className="px-1 py-0.5 rounded text-[9px] font-bold uppercase bg-[var(--bg-hover)] text-[var(--text-muted)]"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setConfirmTrigger(job.id);
                        setConfirmToggle(null);
                        setConfirmDelete(null);
                      }}
                      disabled={actionLoading === job.id || !job.enabled}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-[10px] font-bold uppercase tracking-wider text-[var(--accent-gold)] bg-[var(--accent-gold)]/10 hover:bg-[var(--accent-gold)]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Trigger manually"
                    >
                      {actionLoading === job.id && confirmTrigger === job.id ? (
                        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3 w-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
                        </svg>
                      )}
                      Run
                    </button>
                  )}

                  {/* Delete */}
                  {confirmDelete === job.id ? (
                    <div className="flex items-center gap-1 animate-fade-in">
                      <button
                        onClick={() => executeDelete(job.id)}
                        className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[var(--accent-coral)] text-white hover:bg-[var(--accent-coral-bright)]"
                      >
                        Del!
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-1 py-0.5 rounded text-[9px] font-bold uppercase bg-[var(--bg-hover)] text-[var(--text-muted)]"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setConfirmDelete(job.id);
                        setConfirmToggle(null);
                        setConfirmTrigger(null);
                      }}
                      disabled={actionLoading === job.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-[10px] font-bold uppercase tracking-wider text-[var(--accent-coral)] bg-[rgba(244,63,94,0.08)] hover:bg-[rgba(244,63,94,0.15)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Delete job"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3 w-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal - "+ New Cron Job" */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 animate-fade-in">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-zoom-in">
            <div className="flex items-center justify-between mb-4 border-b border-[var(--border-subtle)] pb-3">
              <h2 className="text-sm font-bold text-[var(--text-primary)] font-display uppercase tracking-wider">
                Create New Cron Job
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-[var(--radius-sm)] bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.15)] p-3 text-xs text-[var(--accent-coral)]">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmitModal} className="space-y-4">
              {/* Job Name */}
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1">
                  Job Name <span className="text-[var(--accent-coral)]">*</span>
                </label>
                <input
                  type="text"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  required
                  placeholder="e.g. daily-health-check"
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)]/40"
                />
              </div>

              {/* Target Bot Selection */}
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1">
                  Target Bot <span className="text-[var(--accent-coral)]">*</span>
                </label>
                <select
                  value={modalBotId}
                  onChange={(e) => setModalBotId(e.target.value)}
                  required
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2.5 py-2 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)]/40"
                >
                  {bots.length === 0 ? (
                    <option value="">No bots active. Fallback to system default.</option>
                  ) : (
                    bots.map((bot) => (
                      <option key={bot.bot_id || bot.name} value={bot.bot_id || bot.name}>
                        {bot.name} ({bot.platform})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Schedule Expression */}
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1">
                  Schedule Expression <span className="text-[var(--accent-coral)]">*</span>
                </label>
                <input
                  type="text"
                  value={modalSchedule}
                  onChange={(e) => setModalSchedule(e.target.value)}
                  required
                  placeholder="cron:0 9 * * 1-5"
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs font-mono text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)]/40"
                />
                
                {modalScheduleError && (
                  <p className="text-[10px] text-[var(--accent-coral)] mt-1 font-semibold">
                    {modalScheduleError}
                  </p>
                )}

                {/* Schedule pattern instructions */}
                <div className="mt-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)]/40 border border-[var(--border-subtle)] p-2 text-[10px] text-[var(--text-muted)] space-y-1">
                  <p className="font-bold text-[var(--text-primary)] uppercase tracking-wide text-[9px] mb-0.5">Format Guide:</p>
                  <p><span className="font-mono text-[var(--accent-gold)]">cron:* * * * *</span> — e.g. <span className="font-mono">cron:0 9 * * 1-5</span> (Every weekday at 9:00 AM)</p>
                  <p><span className="font-mono text-[var(--accent-gold)]">every:DURATION</span> — e.g. <span className="font-mono">every:30m</span> or <span className="font-mono">every:2h</span></p>
                  <p><span className="font-mono text-[var(--accent-gold)]">at:TIMESTAMP</span> — RFC3339 format, e.g. <span className="font-mono">at:2026-05-11T09:00:00+08:00</span></p>
                </div>
              </div>

              {/* Message (Inject Prompt) */}
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1">
                  Prompt Message <span className="text-[var(--accent-coral)]">*</span>
                </label>
                <textarea
                  value={modalMessage}
                  onChange={(e) => setModalMessage(e.target.value)}
                  required
                  rows={3}
                  placeholder="Task prompt injected into the session..."
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)]/40 resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Owner ID */}
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1">
                    Owner ID
                  </label>
                  <input
                    type="text"
                    value={modalOwnerId}
                    onChange={(e) => setModalOwnerId(e.target.value)}
                    placeholder="admin"
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)]/40"
                  />
                </div>

                {/* Max Runs */}
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1">
                    Max Runs
                  </label>
                  <input
                    type="number"
                    value={modalMaxRuns}
                    onChange={(e) => setModalMaxRuns(e.target.value)}
                    min={0}
                    placeholder="Unlimited"
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)]/40"
                  />
                </div>
              </div>

              {/* Expires At */}
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1">
                  Expires At
                </label>
                <input
                  type="text"
                  value={modalExpiresAt}
                  onChange={(e) => setModalExpiresAt(e.target.value)}
                  placeholder="e.g. 2027-01-01T00:00:00+08:00"
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)]/40"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting || !!modalScheduleError}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--accent-gold)] text-black text-xs font-bold uppercase tracking-wider hover:bg-[var(--accent-gold-bright)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {modalSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : null}
                  Create Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
