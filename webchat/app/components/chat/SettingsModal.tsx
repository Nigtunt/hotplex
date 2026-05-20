'use client';

import { useState, useEffect } from 'react';
import { useChatConfig } from '@/hooks/use-chat-config';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function SettingsModal({ open, onClose, onSaved }: SettingsModalProps) {
  const { apiKey, wsUrl, setApiKey, setWsUrl } = useChatConfig();

  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftUrl, setDraftUrl] = useState(wsUrl);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setDraftKey(apiKey);
      setDraftUrl(wsUrl);
      setSaved(false);
    }
  }, [open, apiKey, wsUrl]);

  if (!open) return null;

  const handleSave = () => {
    setApiKey(draftKey.trim());
    setWsUrl(draftUrl.trim());
    setSaved(true);
    onSaved?.();
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setApiKey('dev');
    setDraftKey('dev');
    setWsUrl('');
    setDraftUrl('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[#1a1a1f] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl p-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-display font-bold text-[var(--text-primary)]">
            Connection Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* API Key */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
            X-API-Key
          </label>
          <input
            type="password"
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            placeholder="Enter your API key..."
            className="w-full px-3 py-2.5 bg-[#0d0d10] border border-[rgba(255,255,255,0.1)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent-gold)] focus:ring-1 focus:ring-[var(--accent-gold)]/30 transition-all font-mono"
          />
          <p className="mt-1 text-[10px] text-[var(--text-faint)]">
            Required for gateway authentication. Used in WebSocket init and REST API calls.
          </p>
        </div>

        {/* WebSocket URL */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
            WebSocket URL
          </label>
          <input
            type="text"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder="ws://localhost:8888/ws"
            className="w-full px-3 py-2.5 bg-[#0d0d10] border border-[rgba(255,255,255,0.1)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent-gold)] focus:ring-1 focus:ring-[var(--accent-gold)]/30 transition-all font-mono"
          />
          <p className="mt-1 text-[10px] text-[var(--text-faint)]">
            Auto-detected from page URL if left empty.
          </p>
        </div>

        {/* Saved indicator */}
        {saved && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.2)] text-xs text-[var(--accent-emerald)] font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Settings saved. Reconnecting with new credentials...
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleReset}
            className="px-3 py-2 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--accent-coral)] transition-colors"
          >
            Reset to Defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-hover)] rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-black bg-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/90 rounded-lg shadow-[0_4px_16px_rgba(251,191,36,0.15)] active:scale-95 transition-all"
            >
              Save & Reconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
