/**
 * StatCard — the reusable tile shell.
 * accent: one of 'prod' | 'pending' | 'people' | 'money' (maps to theme colors).
 * Shows an icon chip, a descriptive title, an oversized hero value with unit,
 * a one-line plain-language summary, and a free-form detail area below.
 */
const ACCENT = {
  prod:    { text: 'text-prod',    ring: 'shadow-prod/10',    chip: 'bg-prod/15 text-prod',       bar: 'bg-prod' },
  pending: { text: 'text-pending', ring: 'shadow-pending/10', chip: 'bg-pending/15 text-pending', bar: 'bg-pending' },
  people:  { text: 'text-people',  ring: 'shadow-people/10',  chip: 'bg-people/15 text-people',   bar: 'bg-people' },
  money:   { text: 'text-money',   ring: 'shadow-money/10',   chip: 'bg-money/15 text-money',      bar: 'bg-money' },
}

export default function StatCard({ accent = 'prod', icon, title, subtitle, value, unit, summary, children, delay = 0 }) {
  const a = ACCENT[accent]
  return (
    <section
      style={{ animationDelay: `${delay}ms` }}
      className={`rise relative overflow-hidden rounded-3xl border border-hair bg-surface p-5 shadow-xl ${a.ring}`}
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${a.bar}`} />
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl ${a.chip}`}>{icon}</div>
      </header>

      <div className="mt-4 flex items-end gap-2">
        <span className={`numerals font-display text-5xl font-extrabold leading-none ${a.text}`}>{value}</span>
        {unit && <span className="mb-1 text-sm font-medium text-muted">{unit}</span>}
      </div>
      {summary && <p className="mt-2 text-sm text-muted">{summary}</p>}

      {children && <div className="mt-4 border-t border-hair pt-4">{children}</div>}
    </section>
  )
}

/** Small labelled pill used inside card detail areas. */
export function Pill({ label, value, accent = 'people' }) {
  const a = ACCENT[accent]
  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
      <span className="truncate text-sm text-ink/90">{label}</span>
      <span className={`numerals ml-3 shrink-0 text-sm font-semibold ${a.text}`}>{value}</span>
    </div>
  )
}
