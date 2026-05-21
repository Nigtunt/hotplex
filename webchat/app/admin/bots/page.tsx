'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listBots } from '@/lib/api/admin-bots';
import type { BotConfigEntry } from '@/lib/types/admin';
import { BotCard } from '@/components/admin/bot-card';

export default function BotsPage() {
  const [bots, setBots] = useState<BotConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await listBots();
        if (!cancelled) setBots(data ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load bots');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-display font-bold text-[var(--text-primary)]">Bots</h1>
            {!loading && !error && (
              <span className="text-[11px] font-mono text-[var(--text-faint)] px-2 py-0.5 rounded-full bg-[var(--bg-hover)]">
                {bots.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-surface)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              Refresh
            </button>
            <Link
              href="/admin/bots/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-bold uppercase tracking-wider bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold-bright)] transition-colors"
            >
              + New Bot
            </Link>
          </div>
        </div>

        {/* Error Block */}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 animate-pulse"
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-4 w-32 bg-[var(--bg-elevated)] rounded"></div>
                  <div className="h-3.5 w-12 bg-[var(--bg-elevated)] rounded-full"></div>
                </div>
                {/* Status + worker info */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-4 w-16 bg-[var(--bg-elevated)] rounded-full"></div>
                  <div className="h-3 w-20 bg-[var(--bg-elevated)] rounded"></div>
                </div>
                {/* Connected time */}
                <div className="h-3 w-28 bg-[var(--bg-elevated)] rounded mb-3"></div>
                {/* Agent config source badges */}
                <div className="flex gap-1.5 pt-3 border-t border-[var(--border-subtle)]">
                  <div className="h-3.5 w-10 bg-[var(--bg-elevated)] rounded"></div>
                  <div className="h-3.5 w-10 bg-[var(--bg-elevated)] rounded"></div>
                  <div className="h-3.5 w-10 bg-[var(--bg-elevated)] rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && bots.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--bg-hover)] text-[var(--text-faint)]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-.778.099-1.533.284-2.253" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">No configured bots</h3>
            <p className="text-xs text-[var(--text-muted)] mb-5 max-w-xs">Create your first messaging bot connection to bridge Slack or Feishu with the gateway.</p>
            <Link
              href="/admin/bots/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-bold uppercase tracking-wider bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold-bright)] transition-colors animate-pulse"
            >
              + New Bot
            </Link>
          </div>
        )}

        {/* Bot grid */}
        {!loading && !error && bots.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {bots.map((bot) => (
              <BotCard key={bot.name} bot={bot} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
