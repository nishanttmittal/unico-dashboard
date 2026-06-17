/** Number / money formatting in the Indian convention. */

export const nIN = (n) =>
  (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

/** ₹ amount, Indian grouping, no paise. Handles negative sign cleanly. */
export const money = (n) => {
  const v = Math.round(Number(n) || 0)
  const sign = v < 0 ? '-' : ''
  return `${sign}₹${Math.abs(v).toLocaleString('en-IN')}`
}

/** Compact form for very large tallies, e.g. 12,400 → "12.4k". */
export const compact = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 100000) return (v / 100000).toFixed(1).replace(/\.0$/, '') + 'L'
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return nIN(v)
}
