'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getBot } from '@/lib/api/admin-bots';
import { BotConfigEditor } from '@/components/admin/bot-config-editor';
import { SystemPromptPreview } from '@/components/admin/system-prompt-preview';
import { StatusBadge } from '@/components/admin/status-badge';
import { InfoRow } from '@/components/admin/info-row';
import { getErrorMessage } from '@/lib/get-error-message';
import type { BotConfigEntry } from '@/lib/types/admin';

type TabKey = 'overview' | 'config' | 'access';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'config', label: 'Config' },
  { key: 'access', label: 'Access' },
];

export function BotDetailView() {
  const searchParams = useSearchParams();
  const name = searchParams.get('name') ?? '';

  const [bot, setBot] = useState<BotConfigEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getBot(name)
      .then((data: BotConfigEntry) => {
        if (!cancelled) setBot(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load bot'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [name, refreshTrigger]);

  const handleRetry = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  if (!name) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-[var(--text-faint)]">No bot name specified</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-4 w-4 bg-[var(--bg-elevated)] rounded"></div>
          <div className="h-6 w-36 bg-[var(--bg-elevated)] rounded"></div>
          <div className="h-5 w-16 bg-[var(--bg-elevated)] rounded-full"></div>
          <div className="h-5 w-20 bg-[var(--bg-elevated)] rounded-full"></div>
        </div>

        {/* Tab Bar Skeleton */}
        <div className="flex gap-4 mb-6 border-b border-[var(--border-subtle)] pb-2">
          <div className="h-4 w-16 bg-[var(--bg-elevated)] rounded"></div>
          <div className="h-4 w-16 bg-[var(--bg-elevated)] rounded"></div>
          <div className="h-4 w-16 bg-[var(--bg-elevated)] rounded"></div>
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-2">
              <div className="h-3 w-16 bg-[var(--bg-elevated)] rounded"></div>
              <div className="h-4 w-40 bg-[var(--bg-elevated)] rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="rounded-[var(--radius-md)] bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.15)] p-6 max-w-sm text-center">
          <p className="text-sm text-[var(--accent-coral)] mb-4">{error || 'Bot not found'}</p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-bold uppercase tracking-wider bg-[var(--accent-coral)]/10 text-[var(--accent-coral)] border border-[var(--accent-coral)]/20 hover:bg-[var(--accent-coral)]/20 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const cfg = bot.config;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/bots"
          className="text-[var(--text-faint)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="text-xl font-display font-bold text-[var(--text-primary)]">{name}</h1>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)] uppercase">
          {bot.platform}
        </span>
        <StatusBadge status={bot.status} />
        <SystemPromptPreview botName={name} />
      </div>

      <div className="flex gap-1 mb-6 border-b border-[var(--border-subtle)]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-[var(--accent-gold)] text-[var(--accent-gold)]'
                : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="Bot ID" value={bot.bot_id} mono />
          <InfoRow label="Worker Type" value={cfg?.worker_type ?? ''} mono />
          <InfoRow label="Work Dir" value={cfg?.work_dir ?? ''} mono />
          <InfoRow label="Connected At" value={bot.connected_at ?? ''} />
        </div>
      )}

      {activeTab === 'config' && <BotConfigEditor botName={name} />}

      {activeTab === 'access' && (
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="DM Policy" value={cfg?.dm_policy ?? ''} />
          <InfoRow label="Group Policy" value={cfg?.group_policy ?? ''} />
          <InfoRow label="Require Mention" value={cfg?.require_mention ? 'Yes' : 'No'} />
          <InfoRow label="Allow From" value={cfg?.allow_from?.join(', ') ?? ''} />
          <InfoRow label="Allow DM From" value={cfg?.allow_dm_from?.join(', ') ?? ''} />
          <InfoRow label="Allow Group From" value={cfg?.allow_group_from?.join(', ') ?? ''} />
        </div>
      )}
    </div>
  );
}
