# UNICO CEO Dashboard — Phase 1 Design (2026-06-17)

## Purpose
A single, read-only "command center" the owner opens each morning to see the
whole factory at a glance. Reads live data the existing apps already produce;
**never writes** to Firestore (zero risk to production apps).

## Architecture
- Standalone React 19 + Vite 8 + Tailwind 4 app (`unico-dashboard`).
- Reads the shared `unico-operations` Firebase project under `apps/{ns}/…`
  plus the root `att_*` collections.
- Google login + an access allowlist (owner + managers) gate the UI.
- Deploy: GitHub Pages (`npm run deploy` → gh-pages), WhatsApp-shareable link.
- "Today" = calendar day in IST (Asia/Kolkata).

## Phase 1 tiles & data sources (field shapes confirmed from live data)
| Tile | Source | Definition |
|---|---|---|
| Today's Production | `apps/welder/dispatches` qty + `apps/platingjobwork/challans` (direction `in`) + `apps/plasticjobwork/production` | pieces handled today across processes |
| Pending / WIP | plating `challans` OUT−IN per party+product; welder `plating_outbox` (pushed=false) | pieces stuck at platers + waiting to send |
| Manpower | `att_salary` (active) by dept; `att_attendance` (this month) | active headcount + month OT/present-days |
| Contractor Money | welder `settlements` (latest per welder): opening+earned−advances−payments | balance per contractor (matches Hisab) |

## Known limitations (honest, for Phase 2)
- No ₹-profit tile — costing engine not built yet.
- Manpower shows headcount + month-to-date, NOT live "today present/absent" —
  attendance is stored monthly; daily present/absent needs the attendance bot to
  write a daily status doc (Phase 2 wire-up).
- Plastic shows 0 until the plastic app goes live.
- Contractor balance is "as of last Hisab" (settlement), not live-recalculated.

## Security note
The dashboard's own gate (Google login + allowlist) is solid. The underlying
Firestore rules are still open (`if signedIn()`) per the 2026-06-14 security
audit — pre-existing, not caused by this app, but worth fixing soon now that
money/production data is surfaced more visibly.
