import { useEffect, useState, useCallback } from 'react'
import { watchAuth, signOutUser, isAllowed } from './firebase'
import { getTodayProduction, getPending, getContractorMoney, getManpower } from './lib/sources'
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

  const allowed = isAllowed(email)

  const load = useCallback(async () => {
    setRefreshing(true)
    const [prod, pend, money_, people] = await Promise.allSettled([
      getTodayProduction(), getPending(), getContractorMoney(), getManpower(),
    ])
    setData({
      prod: prod.value ?? null,
      pend: pend.value ?? null,
      money: money_.value ?? null,
      people: people.value ?? null,
    })
    setUpdated(nowTimeIST())
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => watchAuth((u) => {
    setEmail(u ? (u.email || '').toLowerCase() : null)
    setAuthReady(true)
  }), [])

  useEffect(() => {
    if (!allowed) return
    load()
    const t = setInterval(load, 90_000) // gentle live refresh
    return () => clearInterval(t)
  }, [allowed, load])

  if (!authReady) return <Splash />
  if (!email) return <Login onError={setLoginErr} />
  if (loginErr && !email) return <Login onError={setLoginErr} />
  if (!allowed) return <Login blocked />

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pb-10">
      <Header updated={updated} refreshing={refreshing} onRefresh={load} />

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
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          UNICO <span className="text-people">·</span> CEO
        </h1>
        <p className="text-sm text-muted">{prettyDate()}</p>
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
