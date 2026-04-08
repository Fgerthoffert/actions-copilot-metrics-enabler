/**
 * Aggregates a category's metric values by period and group across all daily files.
 * Groups are sorted by total value descending and limited to the top 15 for readability.
 * Periods are sorted chronologically and limited to the most recent maxPeriods.
 */

import { dateToPeriod } from './dateToPeriod.js'
import { getGroupKey } from './getGroupKey.js'
import type { PeriodType } from './dateToPeriod.js'

export interface AggregatedData {
  periods: string[]
  groups: string[]
  values: Map<string, Map<string, number>>
}

export const aggregateCategory = (
  dailyFiles: Record<string, unknown>[],
  category: string,
  metric: string,
  periodType: PeriodType,
  maxPeriods: number
): AggregatedData => {
  const periodGroupValues = new Map<string, Map<string, number>>()
  const groupTotals = new Map<string, number>()

  for (const file of dailyFiles) {
    const day = file.day as string
    const items = file[category] as Record<string, unknown>[] | undefined
    if (!items || !Array.isArray(items)) continue

    const period = dateToPeriod(day, periodType)

    for (const item of items) {
      const group = getGroupKey(category, item)
      const value = (item[metric] as number) || 0

      if (!periodGroupValues.has(period)) {
        periodGroupValues.set(period, new Map())
      }
      const groupMap = periodGroupValues.get(period)!
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
