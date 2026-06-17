/** Date helpers — everything is reckoned in IST (Asia/Kolkata). */

/** Today as 'YYYY-MM-DD' in IST, regardless of the device timezone. */
export function todayIST() {
  // en-CA formats as YYYY-MM-DD; forcing the zone keeps it correct abroad too.
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

/** Current month as 'YYYY-MM' in IST. */
export function monthIST() {
  return todayIST().slice(0, 7)
}

/** Friendly long date, e.g. "Tue, 17 Jun 2026". */
export function prettyDate(dateStr = todayIST()) {
  const d = new Date(dateStr + 'T00:00:00+05:30')
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

/** Time like "3:42 PM" in IST — used for the 'updated' stamp. */
export function nowTimeIST() {
  return new Date().toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
  })
}
