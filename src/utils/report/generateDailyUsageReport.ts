/**
 * Generates an AI adoption report from the transformed daily-usage.ndjson.
 * Shows daily_active_users and user_initiated_interaction_count over time,
 * aggregated monthly then listed weekly.
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import type { ReportFile } from './writeReportFiles.js'

interface DailyUsageEntry {
  day: string
  daily_active_users: number
  user_initiated_interaction_count: number
  active_users: string[]
  active_users_with_interactions: string[]
  active_users_without_interactions: string[]
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

const isWeekday = (dateStr: string): boolean => {
  const d = new Date(dateStr + 'T00:00:00Z')
  const dow = d.getUTCDay()
  return dow >= 1 && dow <= 5
}

const getISOWeek = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00Z')
  const dayOfWeek = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  )
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

interface MonthAggregate {
  month: string
  daily_active_users_avg: number
  daily_interacting_users_avg: number
  user_initiated_interaction_count: number
  most_interactions: string[]
  least_interactions: string[]
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
      weekdayUserTotal: number
      weekdayInteractingUserTotal: number
      weekdayCount: number
      userInteractionDays: Map<string, number>
    }
  >()
  for (const day of days) {
    const month = day.day.substring(0, 7)
    const existing = monthData.get(month) || {
      totalUsers: 0,
      totalInteractions: 0,
      dayCount: 0,
      weekdayUserTotal: 0,
      weekdayInteractingUserTotal: 0,
      weekdayCount: 0,
      userInteractionDays: new Map<string, number>()
    }
    existing.totalUsers += day.daily_active_users
    existing.totalInteractions += day.user_initiated_interaction_count
    existing.dayCount += 1
    if (isWeekday(day.day)) {
      existing.weekdayUserTotal += day.daily_active_users
      existing.weekdayInteractingUserTotal += (
        day.active_users_with_interactions || []
      ).length
      existing.weekdayCount += 1
    }
    for (const user of day.active_users_with_interactions || []) {
      existing.userInteractionDays.set(
        user,
        (existing.userInteractionDays.get(user) || 0) + 1
      )
    }
    monthData.set(month, existing)
  }

  const months: MonthAggregate[] = [...monthData.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, data]) => {
      const sorted = [...data.userInteractionDays.entries()].sort(
        (a, b) => b[1] - a[1]
      )
      const mostInteractions = sorted.slice(0, 5).map(([u]) => u)
      const leastInteractions = sorted
        .slice(-5)
        .reverse()
        .map(([u]) => u)

      return {
        month,
        daily_active_users_avg:
          data.weekdayCount > 0
            ? Math.round(data.weekdayUserTotal / data.weekdayCount)
            : 0,
        daily_interacting_users_avg:
          data.weekdayCount > 0
            ? Math.round(data.weekdayInteractingUserTotal / data.weekdayCount)
            : 0,
        user_initiated_interaction_count: data.totalInteractions,
        most_interactions: mostInteractions,
        least_interactions: leastInteractions
      }
    })

  let markdown = `# AI Adoption — Usage Over Time\n\n`
  markdown += `[← Back to Index](README.md)\n\n`

  // Monthly table
  markdown += `## Monthly\n\n`
  markdown += `| Month | Avg Active Users / Day (weekdays) | Avg Interacting Users / Day (weekdays) | User Initiated Interactions | Most Interactions (5) | Least Interactions (5) |\n`
  markdown += `| --- | --- | --- | --- | --- | --- |\n`
  for (const m of months) {
    markdown += `| ${m.month} | ${m.daily_active_users_avg} | ${m.daily_interacting_users_avg} | ${m.user_initiated_interaction_count} | ${m.most_interactions.join(', ')} | ${m.least_interactions.join(', ')} |\n`
  }
  markdown += '\n'

  // Weekly table
  const weekData = new Map<
    string,
    {
      interactions: number
      activeUsersWithInteractions: Set<string>
      activeUsersWithoutInteractions: Set<string>
      allUsers: Set<string>
    }
  >()
  for (const day of days) {
    const week = getISOWeek(day.day)
    const existing = weekData.get(week) || {
      interactions: 0,
      activeUsersWithInteractions: new Set<string>(),
      activeUsersWithoutInteractions: new Set<string>(),
      allUsers: new Set<string>()
    }
    existing.interactions += day.user_initiated_interaction_count
    for (const u of day.active_users_with_interactions || []) {
      existing.activeUsersWithInteractions.add(u)
      existing.allUsers.add(u)
    }
    for (const u of day.active_users_without_interactions || []) {
      existing.allUsers.add(u)
      // Only add if not already in with-interactions for this week
      if (!existing.activeUsersWithInteractions.has(u)) {
        existing.activeUsersWithoutInteractions.add(u)
      }
    }
    for (const u of day.inactive_users) existing.allUsers.add(u)
    weekData.set(week, existing)
  }

  const weeks = [...weekData.keys()].sort().reverse()

  markdown += `## Weekly\n\n`
  markdown += `| Week | Active Users with Interactions | Active Users without Interactions | User Initiated Interactions | Active Users with Interactions List | Active Users without Interactions List | Inactive Users |\n`
  markdown += `| --- | --- | --- | --- | --- | --- | --- |\n`
  for (const week of weeks) {
    const data = weekData.get(week)!
    // Users who had interactions at some point in the week are removed from without-interactions
    const withInteractions = [...data.activeUsersWithInteractions].sort(
      (a, b) => a.toLowerCase().localeCompare(b.toLowerCase())
    )
    const withoutInteractions = [...data.activeUsersWithoutInteractions]
      .filter((u) => !data.activeUsersWithInteractions.has(u))
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    const allActive = new Set([
      ...data.activeUsersWithInteractions,
      ...data.activeUsersWithoutInteractions
    ])
    const inactiveList = [...data.allUsers]
      .filter((u) => !allActive.has(u))
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    markdown += `| ${week} | ${withInteractions.length} | ${withoutInteractions.length} | ${data.interactions} | ${withInteractions.join(', ')} | ${withoutInteractions.join(', ')} | ${inactiveList.join(', ')} |\n`
  }
  markdown += '\n'

  // Legend
  markdown += `## Definitions\n\n`
  markdown += `| Term | Definition |\n`
  markdown += `| --- | --- |\n`
  markdown += `| **Active Users** | Users who had any Copilot activity (e.g. code completions, chat, CLI) on a given day, regardless of whether they initiated an interaction. |\n`
  markdown += `| **Interacting Users** | Subset of active users who initiated at least one interaction (prompt). Interactions include chat turns, inline suggestions explicitly triggered, and other prompts sent by the user. |\n`
  markdown += `| **Active Users without Interactions** | Users who had Copilot activity (e.g. received code completions) but did not initiate any interaction (prompt) during the period. |\n`
  markdown += `| **Inactive Users** | Users who had no Copilot activity at all during the period. |\n`
  markdown += `| **User Initiated Interactions** | The total number of interactions (prompts) initiated by users, as defined by the GitHub Copilot Metrics API field \`user_initiated_interaction_count\`. |\n`
  markdown += '\n'

  return [{ filename: 'ai-adoption.md', content: markdown }]
}
