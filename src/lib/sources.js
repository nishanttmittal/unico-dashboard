/**
 * sources.js — the dashboard "brain".
 * ──────────────────────────────────────────────────────────────────────────
 * Pure read + aggregate over the live factory data. Each function returns a
 * plain object the UI renders; none of them write anything.
 *
 * Confirmed data shapes (sampled from production 2026-06-17):
 *   apps/welder/dispatches   {date:'YYYY-MM-DD', welder, productName, qty, party}
 *   apps/welder/plating_outbox {date, party, items:[{product,quantity}], pushed:bool}
 *   apps/welder/settlements  {welder, cutoffDate, opening, earned, advances, payments, dayPayments?}
 *   apps/platingjobwork/challans {date, party, direction:'out'|'in', items:[{product,quantity}]}
 *   apps/plasticjobwork/production {date, qty}            (no data yet — future-ready)
 *   att_salary (root)        {name, dept, active:bool}
 *   att_attendance (root)    {month:'YYYY-MM', presentDays, otHrs, lateHrs}
 */
import { readColl, readByDate, readRoot } from '../firebase'
import { todayIST, monthIST } from './dates'

const sumItems = (items) =>
  (Array.isArray(items) ? items : []).reduce((t, it) => t + (Number(it.quantity) || 0), 0)

// ── Tile 1: Today's Production ───────────────────────────────────────────────
export async function getTodayProduction() {
  const today = todayIST()
  const [weld, plate, plastic] = await Promise.all([
    readByDate('welder', 'dispatches', today).catch(() => []),
    readByDate('platingjobwork', 'challans', today).catch(() => []),
    readByDate('plasticjobwork', 'production', today).catch(() => []),
  ])

  const weldQty = weld.reduce((t, d) => t + (Number(d.qty) || 0), 0)
  const weldByProduct = groupSum(weld, (d) => d.productName || d.product || '—', (d) => Number(d.qty) || 0)

  const platedIn = plate.filter((c) => c.direction === 'in').reduce((t, c) => t + sumItems(c.items), 0)
  const platedOut = plate.filter((c) => c.direction === 'out').reduce((t, c) => t + sumItems(c.items), 0)

  const plasticQty = plastic.reduce((t, d) => t + (Number(d.qty) || 0), 0)

  return {
    total: weldQty + platedIn + plasticQty,
    apps: [
      { key: 'weld',    label: 'Welding',      qty: weldQty,   note: `${weld.length} challan${weld.length === 1 ? '' : 's'}`, top: weldByProduct.slice(0, 4) },
      { key: 'plate',   label: 'Plating done', qty: platedIn,  note: platedOut ? `${platedOut.toLocaleString('en-IN')} sent out` : 'returned today' },
      { key: 'plastic', label: 'Plastic',      qty: plasticQty, note: plastic.length ? 'caps' : 'no data yet', muted: !plastic.length },
    ],
  }
}

// ── Tile 2: Pending / WIP (stuck at platers + waiting to be sent) ─────────────
export async function getPending() {
  const [challans, outbox] = await Promise.all([
    readColl('platingjobwork', 'challans').catch(() => []),
    readColl('welder', 'plating_outbox').catch(() => []),
  ])

  // Plating balance per party+product = OUT − IN. Positive = still at the plater.
  const bal = new Map()
  for (const c of challans) {
    const sign = c.direction === 'out' ? 1 : c.direction === 'in' ? -1 : 0
    if (!sign) continue
    for (const it of c.items || []) {
      const key = `${c.party}||${it.product}`
      bal.set(key, (bal.get(key) || 0) + sign * (Number(it.quantity) || 0))
    }
  }
  let platingPendingQty = 0
  const byParty = new Map()
  for (const [key, q] of bal) {
    if (q <= 0) continue
    platingPendingQty += q
    const party = key.split('||')[0]
    byParty.set(party, (byParty.get(party) || 0) + q)
  }
  const topParties = [...byParty.entries()]
    .map(([party, qty]) => ({ party, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  // Welder pieces packed but not yet pushed to plating.
  const toSend = outbox.filter((o) => !o.pushed)
  const welderToSendQty = toSend.reduce((t, o) => t + sumItems(o.items), 0)

  return {
    total: platingPendingQty,
    topParties,
    partiesPending: byParty.size,
    welderToSendQty,
    welderToSendCount: toSend.length,
  }
}

// ── Tile 3: Contractor Money (owed per contractor, from last Hisab) ───────────
export async function getContractorMoney() {
  const settlements = await readColl('welder', 'settlements').catch(() => [])

  // Keep the latest settlement per welder (by cutoffDate).
  const latest = new Map()
  for (const s of settlements) {
    const cur = latest.get(s.welder)
    if (!cur || (s.cutoffDate || '') > (cur.cutoffDate || '')) latest.set(s.welder, s)
  }

  const welders = [...latest.values()].map((s) => {
    const balance = (Number(s.opening) || 0) + (Number(s.earned) || 0)
      - (Number(s.advances) || 0) - (Number(s.payments) || 0) - (Number(s.dayPayments) || 0)
    return { name: s.welder, balance, earned: Number(s.earned) || 0, advances: Number(s.advances) || 0, asOf: s.cutoffDate || '' }
  }).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))

  return {
    total: welders.reduce((t, w) => t + w.balance, 0),
    asOf: welders.reduce((m, w) => (w.asOf > m ? w.asOf : m), ''),
    welders,
  }
}

// ── Tile 4: Manpower (active headcount by dept + this month) ──────────────────
export async function getManpower() {
  const month = monthIST()
  const [staff, att] = await Promise.all([
    readRoot('att_salary').catch(() => []),
    readRoot('att_attendance').catch(() => []),
  ])

  const active = staff.filter((s) => s.active !== false)
  const byDept = groupSum(active, (s) => (s.dept || 'OTHER').toUpperCase(), () => 1)

  const thisMonth = att.filter((a) => a.month === month)
  const otHrs = thisMonth.reduce((t, a) => t + (Number(a.otHrs) || 0), 0)
  const presentDays = thisMonth.reduce((t, a) => t + (Number(a.presentDays) || 0), 0)

  return {
    activeCount: active.length,
    byDept: byDept.slice(0, 6),
    otHrsMonth: Math.round(otHrs),
    presentDaysMonth: presentDays,
    month,
  }
}

// ── helper ────────────────────────────────────────────────────────────────
function groupSum(rows, keyFn, valFn) {
  const m = new Map()
  for (const r of rows) m.set(keyFn(r), (m.get(keyFn(r)) || 0) + valFn(r))
  return [...m.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty)
}

// ── Leads feed: IndiaMART alerts + WhatsApp enquiries, newest first ──────────
// Both are root collections written by the lead pollers (Admin SDK). We merge
// them into one normalized list for the command-center "Leads" view.
export async function getLeads() {
  const [im, wa, statusRows] = await Promise.all([
    readRoot('indiamart_leads').catch(() => []),
    readRoot('whatsapp_leads').catch(() => []),
    readRoot('lead_status').catch(() => []),
  ])
  const statusOf = new Map(statusRows.map((s) => [s.id, s.status || 'new']))
  const skipMeta = (r) => r.id !== '_meta_seeded'

  const imRows = im.filter(skipMeta).map((r) => ({
    id: 'im_' + r.id,
    source: 'IndiaMART',
    name: r.name || 'Buyer',
    company: r.company || '',
    phone: r.mobile || '',
    product: r.product || '',
    message: r.last_message || '',
    place: [r.city, r.state].filter(Boolean).join(', '),
    when: r.last_contact_date || '',
    ts: Date.parse((r.last_contact_date || '').replace(' ', 'T')) || (r.capturedAt?.seconds || 0) * 1000,
    status: statusOf.get('im_' + r.id) || 'new',
  }))

  const waRows = wa.filter(skipMeta).map((r) => ({
    id: 'wa_' + r.id,
    source: 'WhatsApp',
    name: r.name || r.number || 'Buyer',
    company: '',
    phone: r.number || '',
    product: '',
    message: r.firstMessage || '',
    place: '',
    when: r.firstSeenAt || '',
    ts: (r.firstSeenTs ? r.firstSeenTs * 1000 : 0) || (r.capturedAt?.seconds || 0) * 1000,
    status: statusOf.get('wa_' + r.id) || 'new',
  }))

  const all = [...imRows, ...waRows].sort((a, b) => (b.ts || 0) - (a.ts || 0))
  const count = (s) => all.filter((l) => l.status === s).length
  return {
    all,
    total: all.length,
    indiamart: imRows.length,
    whatsapp: waRows.length,
    counts: { new: count('new'), followup: count('followup'), scrap: count('scrap') },
  }
}
