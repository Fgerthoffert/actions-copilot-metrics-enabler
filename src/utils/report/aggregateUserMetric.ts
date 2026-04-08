/**
 * Aggregates user daily files by a single grouping field from a category array,
 * summing (or counting) a specific metric. Supports aggregation across a
 * secondary field (e.g. sum model across all features).
 */

import { dateToPeriod } from './dateToPeriod.js'
import type { PeriodType } from './dateToPeriod.js'
import type { AggregatedData } from './aggregateCategory.js'

export const aggregateUserMetric = (
  userFiles: Record<string, unknown>[],
  category: string,
  groupField: string,
  metric: string,
  periodType: PeriodType,
  maxPeriods: number
): AggregatedData => {
  const periodGroupValues = new Map<string, Map<string, number>>()
  const groupTotals = new Map<string, number>()

  for (const file of userFiles) {
    const day = file.day as string
    if (!day) continue

    const items = file[category] as Record<string, unknown>[] | undefined
    if (!Array.isArray(items)) continue

    const period = dateToPeriod(day, periodType)

    if (!periodGroupValues.has(period)) {
      periodGroupValues.set(period, new Map())
    }
    const groupMap = periodGroupValues.get(period)!

    for (const item of items) {
      const group = String(item[groupField] || 'unknown')
      const value = (item[metric] as number) || 0

      groupMap.set(group, (groupMap.get(group) || 0) + value)
      groupTotals.set(group, (groupTotals.get(group) || 0) + value)
    }
  }

  const periods = [...periodGroupValues.keys()].sort().slice(-maxPeriods)

  const groups = [...groupTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([g]) => g)

  return { periods, groups, values: periodGroupValues }
}
