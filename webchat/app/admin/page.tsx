'use client';

import { useEffect, useState } from 'react';
import { listBots } from '@/lib/api/admin-bots';
import { listCronJobs } from '@/lib/api/admin-cron';
import { MetricCard } from '@/components/admin/metric-card';

interface DashboardMetrics {
  botsTotal: number;
  botsConnected: number;
  botsDisconnected: number;
  sessionsTotal: number;
  sessionsActive: number;
  sessionsDatabase: number;
  cronTotal: number;
  cronEnabled: number;
  gatewayOnline: boolean;
  uptimeSeconds: number;
}

function useDashboardMetrics(refreshTrigger: number) {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    botsTotal: 0,
    botsConnected: 0,
    botsDisconnected: 0,
    sessionsTotal: 0,
    sessionsActive: 0,
    sessionsDatabase: 0,
    cronTotal: 0,
    cronEnabled: 0,
    gatewayOnline: false,
    uptimeSeconds: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const { getAdminStats } = await import('@/lib/api/admin-stats');

        const [botsRes, statsRes, cronRes] = await Promise.allSettled([
          listBots(),
          getAdminStats(),
          listCronJobs(),
        ]);

        if (cancelled) return;

        const m: DashboardMetrics = {
          botsTotal: 0,
          botsConnected: 0,
          botsDisconnected: 0,
          sessionsTotal: 0,
          sessionsActive: 0,
          sessionsDatabase: 0,
          cronTotal: 0,
          cronEnabled: 0,
          gatewayOnline: false,
          uptimeSeconds: 0,
        };

        if (botsRes.status === 'fulfilled') {
          const bots = botsRes.value;
          m.botsTotal = bots.length;
          m.botsConnected = bots.filter((b) => b.status === 'connected').length;
          m.botsDisconnected = bots.filter((b) => b.status !== 'connected').length;
          m.gatewayOnline = true;
        }

        if (statsRes.status === 'fulfilled') {
          const stats = statsRes.value;
          m.sessionsTotal = stats.gateway.sessions_total;
          m.sessionsActive = stats.gateway.sessions_active;
          m.sessionsDatabase = stats.database.sessions_count;
          m.uptimeSeconds = stats.gateway.uptime_seconds;
          m.gatewayOnline = true;
        }

        if (cronRes.status === 'fulfilled') {
          const jobs = cronRes.value;
          m.cronTotal = jobs.length;
          m.cronEnabled = jobs.filter((j) => j.enabled).length;
          m.gatewayOnline = true;
        }

        const allFailed =
          botsRes.status === 'rejected' &&
          statsRes.status === 'rejected' &&
          cronRes.status === 'rejected';

        if (allFailed) {
          const firstErr = botsRes.reason;
          setError(
            firstErr instanceof Error ? firstErr.message : 'Gateway unreachable',
          );
        } else if (statsRes.status === 'rejected') {
          const statsErr = statsRes.reason;
          setError(`Telemetry warning: Failed to query stats endpoint. ${statsErr instanceof Error ? statsErr.message : ''}`);
        }

        setMetrics(m);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  return { metrics, loading, error };
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);

  return parts.join(' ');
}

export default function DashboardPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { metrics, loading, error } = useDashboardMetrics(refreshTrigger);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-display font-bold text-[var(--text-primary)]">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Gateway overview and system status
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-all hover:bg-[var(--bg-elevated)] disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            Refresh
          </button>
        </div>

        {/* Telemetry Error Banner */}
        {error && (
          <div className="mb-6 rounded-[var(--radius-md)] bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.15)] p-4 flex items-center justify-between">
            <p className="text-sm text-[var(--accent-coral)]">{error}</p>
            <button
              onClick={handleRefresh}
              className="text-xs font-semibold text-[var(--accent-coral)] underline hover:text-[var(--accent-coral)]/80"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex flex-col gap-2.5 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 animate-pulse"
              >
                <div className="h-3 w-16 bg-[var(--bg-elevated)] rounded"></div>
                <div className="h-8 w-24 bg-[var(--bg-elevated)] rounded mt-1"></div>
                <div className="h-3 w-40 bg-[var(--bg-elevated)] rounded"></div>
              </div>
            ))}
          </div>
        )}

        {/* Metric cards -- always render once loading finishes */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bots */}
            <MetricCard
              label="Bots"
              value={metrics.botsTotal}
              sub={`${metrics.botsConnected} connected, ${metrics.botsDisconnected} disconnected`}
            />

            {/* Sessions */}
            <MetricCard
              label="Sessions (Active)"
              value={metrics.sessionsActive}
              sub={`${metrics.sessionsActive} active of ${metrics.sessionsTotal} total (${metrics.sessionsDatabase} database)`}
            />

            {/* Cron Jobs */}
            <MetricCard
              label="Cron Jobs"
              value={metrics.cronTotal}
              sub={`${metrics.cronEnabled} enabled`}
            />

            {/* Gateway Uptime */}
            <MetricCard
              label="Gateway"
              value={metrics.gatewayOnline ? 'Running' : 'Offline'}
              sub={
                metrics.gatewayOnline
                  ? `Uptime: ${formatUptime(metrics.uptimeSeconds)}`
                  : 'Unable to reach gateway'
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
