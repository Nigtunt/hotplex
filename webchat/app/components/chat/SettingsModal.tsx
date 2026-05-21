'use client';

import { useState, useEffect } from 'react';
import { useChatConfig } from '@/hooks/use-chat-config';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

/** Derive HTTP base URL from a WebSocket URL for API calls. */
function wsToHttp(wsUrl: string): string {
  return wsUrl
    .replace(/^ws:\/\//, 'http://')
    .replace(/^wss:\/\//, 'https://')
    .replace(/\/ws\/?$/, '');
}

export function SettingsModal({ open, onClose, onSaved }: SettingsModalProps) {
  const { apiKey, wsUrl, setApiKey, setWsUrl } = useChatConfig();

  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftUrl, setDraftUrl] = useState(wsUrl);
  const [saved, setSaved] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraftKey(apiKey);
      setDraftUrl(wsUrl);
      setSaved(false);
      setValidationError(null);
    }
  }, [open, apiKey, wsUrl]);

  if (!open) return null;

  const handleSave = async () => {
    const key = draftKey.trim();
    const url = draftUrl.trim();

    setValidationError(null);
    setValidating(true);

    try {
      // Validate the API Key by making a test request
      const httpUrl = wsToHttp(url || wsUrl);
      const res = await fetch(`${httpUrl}/api/sessions`, {
        headers: { 'X-API-Key': key },
        signal: AbortSignal.timeout(10000),
      });

      if (res.status === 401) {
        setValidationError('API Key is invalid. The server rejected authentication.');
        setValidating(false);
        return;
      }

      if (!res.ok && res.status !== 200) {
        setValidationError(`Server responded with HTTP ${res.status}. Please check the WebSocket URL.`);
        setValidating(false);
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('AbortError') || msg.includes('timeout')) {
        setValidationError('Connection timed out. Please check that the gateway is running and the WebSocket URL is correct.');
      } else {
        setValidationError(`Cannot reach the gateway: ${msg}`);
      }
      setValidating(false);
      return;
    }

    setValidating(false);
    setApiKey(key);
    setWsUrl(url);
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

        {/* Validation error */}
        {validationError && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.2)] text-xs text-[var(--accent-coral)] font-medium animate-fade-in">
            {validationError}
          </div>
        )}

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
              disabled={validating}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-black bg-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/90 rounded-lg shadow-[0_4px_16px_rgba(251,191,36,0.15)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Validating...
                </>
              ) : (
                'Save & Reconnect'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
