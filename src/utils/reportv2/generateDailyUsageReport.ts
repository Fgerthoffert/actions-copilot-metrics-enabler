/**
 * Generates an AI adoption report from the transformed daily-usage.ndjson.
 * Shows daily_active_users and user_initiated_interaction_count over time,
 * aggregated monthly then listed daily.
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import type { ReportFile } from '../report/writeReportFiles.js'

interface DailyUsageEntry {
  day: string
  daily_active_users: number
  user_initiated_interaction_count: number
  active_users: string[]
  inactive_users: string[]
}

const loadTransformFile = (transformPath: string): DailyUsageEntry[] => {
  const filePath = path.join(transformPath, 'daily-usage.ndjson')
  if (!fs.existsSync(filePath)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as DailyUsageEntry)
}

interface MonthAggregate {
  month: string
  daily_active_users_avg: number
  user_initiated_interaction_count: number
  most_active: string[]
  least_active: string[]
}

export const generateDailyUsageReport = (
  transformPath: string
): ReportFile[] => {
  const days = loadTransformFile(transformPath)

  if (days.length === 0) {
    core.info('No daily usage data found, skipping AI adoption report')
    return []
  }

  // Aggregate by month
  const monthData = new Map<
    string,
    {
      totalUsers: number
      totalInteractions: number
      dayCount: number
      userActiveDays: Map<string, number>
    }
  >()
  for (const day of days) {
    const month = day.day.substring(0, 7)
    const existing = monthData.get(month) || {
      totalUsers: 0,
      totalInteractions: 0,
      dayCount: 0,
      userActiveDays: new Map<string, number>()
    }
    existing.totalUsers += day.daily_active_users
    existing.totalInteractions += day.user_initiated_interaction_count
    existing.dayCount += 1
    for (const user of day.active_users) {
      existing.userActiveDays.set(
        user,
        (existing.userActiveDays.get(user) || 0) + 1
      )
    }
    monthData.set(month, existing)
  }

  const months: MonthAggregate[] = [...monthData.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, data]) => {
      const sorted = [...data.userActiveDays.entries()].sort(
        (a, b) => b[1] - a[1]
      )
      const mostActive = sorted.slice(0, 5).map(([u]) => u)
      const leastActive = sorted
        .slice(-5)
        .reverse()
        .map(([u]) => u)

      return {
        month,
        daily_active_users_avg: Math.round(data.totalUsers / data.dayCount),
        user_initiated_interaction_count: data.totalInteractions,
        most_active: mostActive,
        least_active: leastActive
      }
    })

  let markdown = `# AI Adoption — Usage Over Time\n\n`
  markdown += `[← Back to Index](README.md)\n\n`

  // Monthly table
  markdown += `## Monthly\n\n`
  markdown += `| Month | Avg Daily Active Users | User Initiated Interactions | Most Active (5) | Least Active (5) |\n`
  markdown += `| --- | --- | --- | --- | --- |\n`
  for (const m of months) {
    markdown += `| ${m.month} | ${m.daily_active_users_avg} | ${m.user_initiated_interaction_count} | ${m.most_active.join(', ')} | ${m.least_active.join(', ')} |\n`
  }
  markdown += '\n'

  // Daily table
  markdown += `## Daily\n\n`
  markdown += `| Date | Daily Active Users | User Initiated Interactions | Active Users | Inactive Users |\n`
  markdown += `| --- | --- | --- | --- | --- |\n`
  for (const day of days) {
    markdown += `| ${day.day} | ${day.daily_active_users} | ${day.user_initiated_interaction_count} | ${day.active_users.join(', ')} | ${day.inactive_users.join(', ')} |\n`
  }
  markdown += '\n'

  return [{ filename: 'ai-adoption.md', content: markdown }]
}
