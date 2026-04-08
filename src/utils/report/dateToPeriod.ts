/**
 * Converts a YYYY-MM-DD date string into a period label based on the period type.
 * - daily: returns the date as-is
 * - weekly: returns ISO week label (e.g., "2026-W14")
 * - monthly: returns year-month (e.g., "2026-04")
 */

export type PeriodType = 'daily' | 'weekly' | 'monthly'

const getISOWeekLabel = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00Z')
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  )
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

export const dateToPeriod = (
  dateStr: string,
  periodType: PeriodType
): string => {
  if (periodType === 'daily') return dateStr
  if (periodType === 'monthly') return dateStr.substring(0, 7)
  return getISOWeekLabel(dateStr)
}
