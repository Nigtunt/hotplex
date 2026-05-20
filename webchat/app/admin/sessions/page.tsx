'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { listSessions, terminateSession, deleteSession } from '@/lib/api/admin-sessions';
import type { AdminSessionInfo } from '@/lib/types/admin';
import { formatRelativeTime } from '@/lib/format-time';
import { getErrorMessage } from '@/lib/get-error-message';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_STATES = ['active', 'working', 'idle', 'terminated', 'error'] as const;
type SessionState = (typeof SESSION_STATES)[number];
type FilterOption = 'all' | SessionState;

const SESSION_STATUS_MAP: Record<SessionState, { bg: string; text: string; dot: string; label: string }> = {
  active: {
    bg: 'rgba(52, 211, 153, 0.12)',
    text: 'text-[var(--accent-emerald)]',
    dot: 'bg-[var(--accent-emerald)]',
    label: 'Active',
  },
  working: {
    bg: 'rgba(52, 211, 153, 0.12)',
    text: 'text-[var(--accent-emerald)]',
    dot: 'bg-[var(--accent-emerald)]',
    label: 'Working',
  },
  idle: {
    bg: 'rgba(245, 158, 11, 0.12)',
    text: 'text-[var(--accent-amber)]',
    dot: 'bg-[var(--accent-amber)]',
    label: 'Idle',
  },
  terminated: {
    bg: 'rgba(161, 161, 170, 0.12)',
    text: 'text-[var(--text-muted)]',
    dot: 'bg-[var(--text-muted)]',
    label: 'Terminated',
  },
  error: {
    bg: 'rgba(244, 63, 94, 0.12)',
    text: 'text-[var(--accent-coral)]',
    dot: 'bg-[var(--accent-coral)]',
    label: 'Error',
  },
};

const DEFAULT_SESSION_STYLE = {
  bg: 'rgba(255, 255, 255, 0.06)',
  text: 'text-[var(--text-muted)]',
  dot: 'bg-[var(--text-muted)]',
  label: '',
};

type SortOption = 'last_active' | 'created';

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Session Status Badge (extends base StatusBadge for session-specific states)
// ---------------------------------------------------------------------------

function SessionStatusBadge({ state }: { state: string }) {
  const style = SESSION_STATUS_MAP[state as SessionState] ?? DEFAULT_SESSION_STYLE;
  const label = style.label || state;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${style.text}`}
      style={{ background: style.bg }}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function SessionsPage() {
  const [sessions, setSessions] = useState<AdminSessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [sort, setSort] = useState<SortOption>('last_active');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmTerminate, setConfirmTerminate] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listSessions(100, 0);
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const filtered = sessions.filter((s) => {
    if (filter === 'all') return true;
    return s.state === filter;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'created') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    // default: sort by updated_at (last active)
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const activeCount = sessions.filter(
    (s) => s.state === 'active' || s.state === 'working',
  ).length;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const executeTerminate = async (id: string) => {
    setConfirmTerminate(null);
    try {
      setActionLoading(id);
      setActionError(null);
      await terminateSession(id);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, state: 'terminated' } : s)),
      );
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to terminate session'));
    } finally {
      setActionLoading(null);
    }
  };

  const executeDelete = async (id: string) => {
    setConfirmDelete(null);
    try {
      setActionLoading(id);
      setActionError(null);
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to delete session'));
    } finally {
      setActionLoading(null);
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
              Sessions
            </h1>
            {!loading && !error && (
              <span className="text-[11px] font-mono text-[var(--text-faint)] px-2 py-0.5 rounded-full bg-[var(--bg-hover)]">
                {activeCount} active / {sessions.length} total
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Status filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterOption)}
              className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)]/40"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="working">Working</option>
              <option value="idle">Idle</option>
              <option value="terminated">Terminated</option>
            </select>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)]/40"
            >
              <option value="last_active">Last Active</option>
              <option value="created">Created</option>
            </select>

            {/* Refresh */}
            <button
              onClick={loadSessions}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

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

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-[var(--radius-md)] bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.15)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--accent-coral)]">{error}</p>
              <button
                onClick={loadSessions}
                className="text-xs font-semibold text-[var(--accent-coral)] underline underline-offset-2 hover:text-[var(--accent-coral)]/80 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px_90px_100px_100px_140px] gap-2 px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">ID</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Worker</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">User</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Status</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Created</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Last Active</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider text-right">Actions</span>
            </div>

            {/* Table skeleton rows */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_100px_100px_90px_100px_100px_140px] gap-2 px-4 py-3 border-b border-[var(--border-subtle)] last:border-b-0 animate-pulse items-center"
              >
                <div className="h-3 w-28 bg-[var(--bg-elevated)] rounded"></div>
                <div className="h-3 w-16 bg-[var(--bg-elevated)] rounded"></div>
                <div className="h-3 w-16 bg-[var(--bg-elevated)] rounded"></div>
                <div className="h-4 w-14 bg-[var(--bg-elevated)] rounded-full"></div>
                <div className="h-3 w-16 bg-[var(--bg-elevated)] rounded"></div>
                <div className="h-3 w-16 bg-[var(--bg-elevated)] rounded"></div>
                <div className="flex justify-end gap-1.5">
                  <div className="h-5 w-12 bg-[var(--bg-elevated)] rounded"></div>
                  <div className="h-5 w-14 bg-[var(--bg-elevated)] rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--bg-hover)] text-[var(--text-faint)]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">No sessions found</h3>
            <p className="text-xs text-[var(--text-muted)] max-w-xs">
              {filter !== 'all' ? `There are no sessions currently matching the "${filter}" filter.` : 'No sessions have been initiated on the gateway yet.'}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && sorted.length > 0 && (
          <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px_90px_100px_100px_140px] gap-2 px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">ID</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Worker</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">User</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Status</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Created</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Last Active</span>
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider text-right">Actions</span>
            </div>

            {/* Table rows */}
            {sorted.map((session) => (
              <div
                key={session.id}
                className="grid grid-cols-[1fr_100px_100px_90px_100px_100px_140px] gap-2 px-4 py-2.5 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-hover)] transition-colors items-center"
              >
                {/* ID */}
                <Link
                  href={`/admin/sessions/detail?id=${encodeURIComponent(session.id)}`}
                  className="text-xs font-mono text-[var(--accent-gold)] hover:text-[var(--accent-gold-bright)] truncate transition-colors"
                  title={session.id}
                >
                  {truncateId(session.id)}
                </Link>

                {/* Worker type */}
                <span className="text-xs text-[var(--text-muted)] truncate" title={session.worker_type}>
                  {session.worker_type || '--'}
                </span>

                {/* User */}
                <span className="text-xs text-[var(--text-muted)] truncate" title={session.user_id}>
                  {session.user_id ? truncateId(session.user_id) : '--'}
                </span>

                {/* Status */}
                <SessionStatusBadge state={session.state} />

                {/* Created */}
                <span className="text-xs text-[var(--text-muted)]" title={session.created_at}>
                  {formatRelativeTime(session.created_at)}
                </span>

                {/* Last active */}
                <span className="text-xs text-[var(--text-muted)]" title={session.updated_at}>
                  {formatRelativeTime(session.updated_at)}
                </span>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1.5">
                  {session.state !== 'terminated' && (
                    <>
                      {confirmTerminate === session.id ? (
                        <div className="flex items-center gap-1 animate-fade-in">
                          <button
                            onClick={() => executeTerminate(session.id)}
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[var(--accent-amber)] text-black hover:bg-[var(--accent-amber-bright)]"
                          >
                            Stop!
                          </button>
                          <button
                            onClick={() => setConfirmTerminate(null)}
                            className="px-1 py-0.5 rounded text-[9px] font-bold uppercase bg-[var(--bg-hover)] text-[var(--text-muted)]"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setConfirmTerminate(session.id);
                            setConfirmDelete(null);
                          }}
                          disabled={actionLoading === session.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-[10px] font-bold uppercase tracking-wider text-[var(--accent-amber)] bg-[rgba(245,158,11,0.1)] hover:bg-[rgba(245,158,11,0.2)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Terminate session"
                        >
                          {actionLoading === session.id && confirmTerminate === session.id ? (
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3 w-3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
                            </svg>
                          )}
                          Stop
                        </button>
                      )}
                    </>
                  )}
                  
                  {confirmDelete === session.id ? (
                    <div className="flex items-center gap-1 animate-fade-in">
                      <button
                        onClick={() => executeDelete(session.id)}
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
                        setConfirmDelete(session.id);
                        setConfirmTerminate(null);
                      }}
                      disabled={actionLoading === session.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-[10px] font-bold uppercase tracking-wider text-[var(--accent-coral)] bg-[rgba(244,63,94,0.08)] hover:bg-[rgba(244,63,94,0.15)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Delete session"
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
    </div>
  );
}
