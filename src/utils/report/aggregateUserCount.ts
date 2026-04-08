/**
 * Counts distinct users per group value from a category array, by period.
 * Used to count how many users use each IDE per period.
 */

import { dateToPeriod } from './dateToPeriod.js'
import type { PeriodType } from './dateToPeriod.js'
import type { AggregatedData } from './aggregateCategory.js'

export const aggregateUserCount = (
  userFiles: Record<string, unknown>[],
  category: string,
  groupField: string,
  periodType: PeriodType,
  maxPeriods: number
): AggregatedData => {
  // Track unique users per period×group
  const periodGroupUsers = new Map<string, Map<string, Set<string>>>()
  const groupTotals = new Map<string, number>()

  for (const file of userFiles) {
    const day = file.day as string
    const userLogin = file.user_login as string
    if (!day || !userLogin) continue

    const items = file[category] as Record<string, unknown>[] | undefined
    if (!Array.isArray(items)) continue

    const period = dateToPeriod(day, periodType)

    if (!periodGroupUsers.has(period)) {
      periodGroupUsers.set(period, new Map())
    }
    const groupMap = periodGroupUsers.get(period)!

    for (const item of items) {
      const group = String(item[groupField] || 'unknown')

      if (!groupMap.has(group)) {
        groupMap.set(group, new Set())
      }
      groupMap.get(group)!.add(userLogin)
    }
  }

  // Convert Sets to counts
  const periodGroupValues = new Map<string, Map<string, number>>()
  for (const [period, groupMap] of periodGroupUsers) {
    const valueMap = new Map<string, number>()
    for (const [group, users] of groupMap) {
      valueMap.set(group, users.size)
      groupTotals.set(group, (groupTotals.get(group) || 0) + users.size)
    }
    periodGroupValues.set(period, valueMap)
  }

  const periods = [...periodGroupValues.keys()].sort().slice(-maxPeriods)

  const groups = [...groupTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([g]) => g)

  return { periods, groups, values: periodGroupValues }
}
