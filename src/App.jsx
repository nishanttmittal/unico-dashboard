import { useEffect, useState, useCallback } from 'react'
import { watchAuth, signOutUser, isAllowed, setLeadStatus } from './firebase'
import { getTodayProduction, getPending, getContractorMoney, getManpower, getLeads } from './lib/sources'
import { prettyDate, nowTimeIST } from './lib/dates'
import { nIN, money } from './lib/format'
import Login from './components/Login'
import StatCard, { Pill } from './components/StatCard'

export default function App() {
  const [authReady, setAuthReady] = useState(false)
  const [email, setEmail] = useState(null)
  const [loginErr, setLoginErr] = useState('')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updated, setUpdated] = useState('')
  const [view, setView] = useState('dashboard')

  const allowed = isAllowed(email)

  // Tiles only — runs on the gentle 90s loop.
  const load = useCallback(async () => {
    setRefreshing(true)
    const [prod, pend, money_, people] = await Promise.allSettled([
      getTodayProduction(), getPending(), getContractorMoney(), getManpower(),
    ])
    setData((prev) => ({
      ...prev,
      prod: prod.value ?? null,
      pend: pend.value ?? null,
      money: money_.value ?? null,
      people: people.value ?? null,
    }))
    setUpdated(nowTimeIST())
    setLoading(false)
    setRefreshing(false)
  }, [])

  // Leads fetched separately — ONLY on open + manual refresh (NOT every 90s),
  // to keep Firestore reads well under the free-tier daily cap.
  const loadLeads = useCallback(async () => {
    try {
      const leads = await getLeads()
      setData((prev) => ({ ...prev, leads }))
    } catch { /* keep previous */ }
  }, [])

  const refreshAll = useCallback(() => { load(); loadLeads() }, [load, loadLeads])

  // Triage a lead (followup / scrap / new) — optimistic UI, then persist.
  const onSetStatus = useCallback(async (id, status) => {
    setData((prev) => {
      if (!prev?.leads) return prev
      const all = prev.leads.all.map((l) => (l.id === id ? { ...l, status } : l))
      const count = (s) => all.filter((l) => l.status === s).length
      return { ...prev, leads: { ...prev.leads, all, counts: { new: count('new'), followup: count('followup'), scrap: count('scrap') } } }
    })
    try { await setLeadStatus(id, status) } catch { load() }
  }, [load])

  useEffect(() => watchAuth((u) => {
    setEmail(u ? (u.email || '').toLowerCase() : null)
    setAuthReady(true)
  }), [])

  useEffect(() => {
    if (!allowed) return
    load()
    loadLeads()
    const t = setInterval(load, 90_000) // gentle live refresh (tiles only)
    return () => clearInterval(t)
  }, [allowed, load, loadLeads])

  if (!authReady) return <Splash />
  if (!email) return <Login onError={setLoginErr} />
  if (loginErr && !email) return <Login onError={setLoginErr} />
  if (!allowed) return <Login blocked />

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pb-10">
      <Header updated={updated} refreshing={refreshing} onRefresh={refreshAll} />

      <Tabs view={view} setView={setView} leadCount={data?.leads?.total} />

      {view === 'dashboard' ? (
        <main className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {loading ? (
            <><Skeleton /><Skeleton /><Skeleton /><Skeleton /></>
          ) : (
            <>
              <ProductionTile d={data?.prod} />
              <PendingTile d={data?.pend} />
              <ManpowerTile d={data?.people} />
              <MoneyTile d={data?.money} />
            </>
          )}
        </main>
      ) : (
        <LeadsView d={data?.leads} loading={loading} onSetStatus={onSetStatus} />
      )}

      <footer className="mt-8 text-center text-xs text-muted">
        Read-only · live from your factory apps · auto-refreshes every 90s
      </footer>
    </div>
  )
}

// ── header ───────────────────────────────────────────────────────────────
function Header({ updated, refreshing, onRefresh }) {
  return (
    <header className="flex items-center justify-between py-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 flex-shrink-0 grid place-items-center rounded-2xl bg-white p-1.5 shadow-sm">
          <img src={`${import.meta.env.BASE_URL}unico-logo.png`} alt="UNICO" className="max-h-full max-w-full object-contain" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            UNICO <span className="text-people">·</span> CEO
          </h1>
          <p className="text-sm text-muted">{prettyDate()}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          className="grid h-11 w-11 place-items-center rounded-2xl border border-hair bg-surface text-lg active:scale-95"
          title={updated ? `Updated ${updated}` : 'Refresh'}
        >
          <span className={refreshing ? 'pulse-soft' : ''}>↻</span>
        </button>
        <button
          onClick={signOutUser}
          className="rounded-2xl border border-hair bg-surface px-3 py-2 text-xs text-muted active:scale-95"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}

// ── tabs ─────────────────────────────────────────────────────────────────
function Tabs({ view, setView, leadCount }) {
  const base = 'flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold transition active:scale-95'
  return (
    <div className="mb-4 flex gap-2 rounded-3xl border border-hair bg-surface p-1.5">
      <button onClick={() => setView('dashboard')}
        className={`${base} ${view === 'dashboard' ? 'bg-surface-2 text-fg' : 'text-muted'}`}>
        Dashboard
      </button>
      <button onClick={() => setView('leads')}
        className={`${base} ${view === 'leads' ? 'bg-surface-2 text-fg' : 'text-muted'}`}>
        Leads{leadCount ? <span className="ml-1.5 rounded-full bg-people/20 px-2 py-0.5 text-xs text-people">{nIN(leadCount)}</span> : null}
      </button>
    </div>
  )
}

// ── leads feed (IndiaMART + WhatsApp) ──────────────────────────────────────
function LeadsView({ d, loading, onSetStatus }) {
  const [filter, setFilter] = useState('todo')
  if (loading) return <div className="space-y-3"><Skeleton /><Skeleton /></div>
  if (!d) return <ErrCard title="Leads" />
  if (!d.all.length) {
    return (
      <div className="rounded-3xl border border-hair bg-surface p-6 text-center">
        <p className="text-sm text-muted">No leads captured yet. New IndiaMART & WhatsApp enquiries will appear here.</p>
      </div>
    )
  }
  const c = d.counts || { new: 0, followup: 0, scrap: 0 }
  const match = (l) => (filter === 'all' ? true : filter === 'todo' ? l.status !== 'scrap' : l.status === filter)
  const rows = d.all.filter(match)
  const chips = [
    { key: 'todo', label: 'To-do', n: c.new + c.followup },
    { key: 'followup', label: '⭐ Follow-up', n: c.followup },
    { key: 'scrap', label: '🗑 Scrap', n: c.scrap },
    { key: 'all', label: 'All', n: d.total },
  ]
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {chips.map((ch) => (
          <button key={ch.key} onClick={() => setFilter(ch.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium active:scale-95 ${filter === ch.key ? 'bg-people/20 text-people' : 'bg-surface text-muted'}`}>
            {ch.label} · {nIN(ch.n)}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-3xl border border-hair bg-surface p-6 text-center">
          <p className="text-sm text-muted">
            {filter === 'scrap' ? 'No scrap leads.' : filter === 'followup' ? 'No follow-ups marked yet — tap ⭐ on a lead.' : 'Nothing here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, 300).map((l) => <LeadCard key={l.id} l={l} onSetStatus={onSetStatus} />)}
        </div>
      )}
    </div>
  )
}

function LeadCard({ l, onSetStatus }) {
  const digits = String(l.phone || '').replace(/\D/g, '')
  const wa = digits ? (digits.length === 10 ? '91' + digits : digits) : ''
  const isIM = l.source === 'IndiaMART'
  const scrap = l.status === 'scrap'
  const followup = l.status === 'followup'
  const border = scrap ? 'border-hair opacity-60' : followup ? 'border-people/50' : 'border-hair'
  const btn = 'flex-1 rounded-2xl py-2 text-center text-sm font-semibold active:scale-95'
  return (
    <div className={`rise rounded-3xl border bg-surface p-4 ${border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{l.name}{l.company ? <span className="text-muted"> · {l.company}</span> : null}</p>
          {l.product ? <p className="truncate text-sm text-prod">📦 {l.product}</p> : null}
          {l.message ? <p className="mt-0.5 line-clamp-2 text-sm text-muted">{l.message}</p> : null}
          <p className="mt-1 text-xs text-muted">{[l.place, l.when].filter(Boolean).join(' · ')}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${isIM ? 'bg-pending/20 text-pending' : 'bg-people/20 text-people'}`}>
          {followup ? '⭐ ' : ''}{isIM ? 'IndiaMART' : 'WhatsApp'}
        </span>
      </div>

      {wa && !scrap ? (
        <div className="mt-3 flex gap-2">
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"
            className="flex-1 rounded-2xl bg-people/15 py-2 text-center text-sm font-semibold text-people active:scale-95">
            💬 Reply on WhatsApp
          </a>
          <a href={`tel:+${wa}`} className="rounded-2xl border border-hair px-4 py-2 text-center text-sm text-muted active:scale-95">📞</a>
        </div>
      ) : null}

      <div className="mt-2 flex gap-2">
        {scrap ? (
          <button onClick={() => onSetStatus(l.id, 'new')} className={`${btn} border border-hair text-muted`}>♻ Restore</button>
        ) : (
          <>
            <button onClick={() => onSetStatus(l.id, followup ? 'new' : 'followup')}
              className={`${btn} ${followup ? 'bg-people/25 text-people' : 'bg-surface-2 text-muted'}`}>
              {followup ? '⭐ Following up' : '⭐ Follow-up'}
            </button>
            <button onClick={() => onSetStatus(l.id, 'scrap')} className={`${btn} bg-surface-2 text-muted`}>🗑 Scrap</button>
          </>
        )}
      </div>
    </div>
  )
}

// ── tiles ────────────────────────────────────────────────────────────────
function ProductionTile({ d }) {
  if (!d) return <ErrCard title="Today’s Production" />
  return (
    <StatCard accent="prod" icon="⚙️" title="Today’s Production" subtitle="pieces handled across all processes"
      value={nIN(d.total)} unit="pcs" delay={0}
      summary={d.total ? 'Live count since midnight (IST)' : 'No production logged yet today'}>
      <div className="space-y-2">
        {d.apps.map((a) => (
          <Pill key={a.key} accent="prod"
            label={`${a.label}${a.muted ? ' · ' + a.note : ''}`}
            value={a.muted ? '—' : `${nIN(a.qty)}`} />
        ))}
        {d.apps[0]?.top?.length > 0 && (
          <p className="pt-1 text-xs text-muted">
            Top: {d.apps[0].top.map((t) => `${t.name} (${nIN(t.qty)})`).join(' · ')}
          </p>
        )}
      </div>
    </StatCard>
  )
}

function PendingTile({ d }) {
  if (!d) return <ErrCard title="Pending / WIP" />
  return (
    <StatCard accent="pending" icon="⏳" title="Pending / WIP" subtitle="stuck at platers right now"
      value={nIN(d.total)} unit="pcs" delay={80}
      summary={`${d.partiesPending} part${d.partiesPending === 1 ? 'y' : 'ies'} pending · ${nIN(d.welderToSendQty)} waiting to send`}>
      <div className="space-y-2">
        {d.topParties.length === 0 && <p className="text-sm text-muted">Nothing pending — all clear ✅</p>}
        {d.topParties.map((p) => (
          <Pill key={p.party} accent="pending" label={p.party} value={`${nIN(p.qty)} pcs`} />
        ))}
      </div>
    </StatCard>
  )
}

function ManpowerTile({ d }) {
  if (!d) return <ErrCard title="Manpower" />
  return (
    <StatCard accent="people" icon="👷" title="Manpower" subtitle="active staff on the rolls"
      value={nIN(d.activeCount)} unit="people" delay={160}
      summary={`This month: ${nIN(d.otHrsMonth)} OT hrs · ${nIN(d.presentDaysMonth)} present-days`}>
      <div className="grid grid-cols-2 gap-2">
        {d.byDept.map((x) => (
          <Pill key={x.name} accent="people" label={x.name} value={nIN(x.qty)} />
        ))}
      </div>
    </StatCard>
  )
}

function MoneyTile({ d }) {
  if (!d) return <ErrCard title="Contractor Money" />
  const owed = d.total >= 0
  return (
    <StatCard accent="money" icon="💰" title="Contractor Money" subtitle="balance from last Hisab"
      value={money(d.total)} delay={240}
      summary={owed
        ? `Payable across ${d.welders.length} contractor${d.welders.length === 1 ? '' : 's'}${d.asOf ? ` · as of ${d.asOf}` : ''}`
        : `Net advance recoverable${d.asOf ? ` · as of ${d.asOf}` : ''}`}>
      <div className="space-y-2">
        {d.welders.map((w) => (
          <Pill key={w.name} accent="money"
            label={w.name}
            value={`${money(w.balance)}${w.balance < 0 ? ' (adv)' : ''}`} />
        ))}
      </div>
    </StatCard>
  )
}

// ── states ─────────────────────────────────────────────────────────────────
function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="text-center">
        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-3xl bg-surface text-3xl pulse-soft">🏭</div>
        <p className="text-muted">Loading…</p>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="rise h-52 rounded-3xl border border-hair bg-surface p-5">
      <div className="pulse-soft space-y-3">
        <div className="h-4 w-1/2 rounded bg-surface-2" />
        <div className="h-10 w-2/3 rounded bg-surface-2" />
        <div className="h-3 w-3/4 rounded bg-surface-2" />
      </div>
    </div>
  )
}

function ErrCard({ title }) {
  return (
    <div className="rounded-3xl border border-hair bg-surface p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-3 text-sm text-pending">Couldn’t load this right now. Pull ↻ to retry.</p>
    </div>
  )
}
