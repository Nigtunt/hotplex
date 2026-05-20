export function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
      <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-sm text-[var(--text-primary)] ${mono ? 'font-mono' : ''} break-all`}>
        {value || '—'}
      </p>
    </div>
  );
}
