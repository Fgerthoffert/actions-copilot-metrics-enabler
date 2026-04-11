/**
 * Generates a per-user AI adoption report from the transformed
 * feature-adoption.ndjson. One table per user showing monthly rows with:
 * - Avg daily interactions (weekdays only)
 * - Total monthly interactions
 * - One column per feature
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import type { ReportFile } from './writeReportFiles.js'

interface UserFeatureEntry {
  login: string
  interactions: number
}

interface FeatureAdoptionEntry {
  feature: string
  interactions: number
  users: UserFeatureEntry[]
}

interface FeatureAdoptionDay {
  day: string
  total_interactions: number
  features: FeatureAdoptionEntry[]
}

const isWeekday = (dateStr: string): boolean => {
  const d = new Date(dateStr + 'T00:00:00Z')
  const dow = d.getUTCDay()
  return dow >= 1 && dow <= 5
}

const loadTransformFile = (transformPath: string): FeatureAdoptionDay[] => {
  const filePath = path.join(transformPath, 'feature-adoption.ndjson')
  if (!fs.existsSync(filePath)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as FeatureAdoptionDay)
}

export const generatePerUserAdoptionReport = (
  transformPath: string
): ReportFile[] => {
  const days = loadTransformFile(transformPath)

  if (days.length === 0) {
    core.info(
      'No feature adoption data found, skipping per-user adoption report'
    )
    return []
  }

  // Collect all unique features, ordered by total interactions descending
  const featureTotals = new Map<string, number>()
  for (const day of days) {
    for (const f of day.features) {
      featureTotals.set(
        f.feature,
        (featureTotals.get(f.feature) || 0) + f.interactions
      )
    }
  }

  const features = [...featureTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f)

  if (features.length === 0) return []

  // Build per-user, per-month aggregation
  // user → month → { totalInteractions, weekdayInteractions, weekdayCount, featureInteractions }
  const userData = new Map<
    string,
    Map<
      string,
      {
        totalInteractions: number
        weekdayInteractions: number
        weekdayCount: number
        featureInteractions: Map<string, number>
      }
    >
  >()

  for (const day of days) {
    const month = day.day.substring(0, 7)
    const weekday = isWeekday(day.day)

    for (const f of day.features) {
      for (const u of f.users) {
        if (!userData.has(u.login)) userData.set(u.login, new Map())
        const userMonths = userData.get(u.login)!

        if (!userMonths.has(month)) {
          userMonths.set(month, {
            totalInteractions: 0,
            weekdayInteractions: 0,
            weekdayCount: 0,
            featureInteractions: new Map()
          })
        }

        const mData = userMonths.get(month)!
        mData.totalInteractions += u.interactions
        if (weekday) {
          mData.weekdayInteractions += u.interactions
        }

        mData.featureInteractions.set(
          f.feature,
          (mData.featureInteractions.get(f.feature) || 0) + u.interactions
        )
      }
    }
  }

  // Track weekday counts per month (same for all users)
  const monthWeekdayCounts = new Map<string, Set<string>>()
  for (const day of days) {
    if (isWeekday(day.day)) {
      const month = day.day.substring(0, 7)
      if (!monthWeekdayCounts.has(month))
        monthWeekdayCounts.set(month, new Set())
      monthWeekdayCounts.get(month)!.add(day.day)
    }
  }

  // Sort users by total interactions descending
  const sortedUsers = [...userData.entries()]
    .map(([login, months]) => {
      const total = [...months.values()].reduce(
        (sum, m) => sum + m.totalInteractions,
        0
      )
      return { login, months, total }
    })
    .sort((a, b) => b.total - a.total)

  let markdown = `# AI Adoption — Per User\n\n`
  markdown += `[← Back to Index](README.md)\n\n`
  markdown += `## Table of Contents\n\n`

  for (const { login } of sortedUsers) {
    markdown += `- [${login}](#${login.toLowerCase().replace(/[^a-z0-9-]/g, '-')})\n`
  }
  markdown += '\n'

  for (const { login, months } of sortedUsers) {
    markdown += `## ${login}\n\n`

    const sortedMonths = [...months.keys()].sort().reverse()

    markdown += `| Month | Avg Daily Interactions (weekdays) | Total Interactions | ${features.join(' | ')} |\n`
    markdown += `| --- | --- | --- | ${features.map(() => '---').join(' | ')} |\n`

    for (const month of sortedMonths) {
      const mData = months.get(month)!
      const weekdayDayCount = monthWeekdayCounts.get(month)?.size || 0
      const avgDaily =
        weekdayDayCount > 0
          ? Math.round(mData.weekdayInteractions / weekdayDayCount)
          : 0

      const featureCells = features
        .map((f) => mData.featureInteractions.get(f) || 0)
        .join(' | ')

      markdown += `| ${month} | ${avgDaily} | ${mData.totalInteractions} | ${featureCells} |\n`
    }
    markdown += '\n'
  }

  return [{ filename: 'per-user-adoption.md', content: markdown }]
}
