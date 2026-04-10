/**
 * Generates per-feature adoption reports from the transformed
 * feature-adoption.ndjson. One markdown file per feature, each with:
 * - Monthly table: feature usage vs total, top 5 / bottom 5 users
 * - Daily table: feature usage vs total, active users for that feature
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

const loadTransformFile = (transformPath: string): FeatureAdoptionDay[] => {
  const filePath = path.join(transformPath, 'feature-adoption.ndjson')
  if (!fs.existsSync(filePath)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as FeatureAdoptionDay)
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

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  chat_panel_agent_mode:
    'User-initiated interactions in the chat panel with agent mode selected.',
  chat_panel_ask_mode:
    'User-initiated interactions in the chat panel with ask mode selected.',
  chat_panel_custom_mode:
    'User-initiated interactions in the chat panel with a custom agent selected.',
  chat_panel_edit_mode:
    'User-initiated interactions in the chat panel with edit mode selected.',
  chat_panel_plan_mode:
    'User-initiated interactions in the chat panel with plan mode selected.',
  chat_panel_unknown_mode:
    'User-initiated interactions in the chat panel where the mode is unknown.',
  chat_inline: 'User-initiated interactions using inline chat in the editor.',
  code_completion: 'Inline code completion suggestions.',
  agent_edit:
    'Lines added and deleted when Copilot (in agent and edit mode) writes changes directly into files. Not included in suggestion-based metrics.'
}

export const generatePerFeatureAdoptionReport = (
  transformPath: string
): ReportFile[] => {
  const days = loadTransformFile(transformPath)

  if (days.length === 0) {
    core.info(
      'No feature adoption data found, skipping per-feature adoption report'
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

  const files: ReportFile[] = []

  for (const feature of features) {
    let markdown = `# Per Feature Adoption — ${feature}\n\n`
    markdown += `[← Back to Index](README.md)\n\n`
    const desc = FEATURE_DESCRIPTIONS[feature]
    if (desc) {
      markdown += `> ${desc}\n\n`
    }

    // Monthly aggregation
    const monthData = new Map<
      string,
      {
        featureInteractions: number
        totalInteractions: number
        dayCount: number
        userTotals: Map<string, number>
      }
    >()

    for (const day of days) {
      const month = day.day.substring(0, 7)
      const existing = monthData.get(month) || {
        featureInteractions: 0,
        totalInteractions: 0,
        dayCount: 0,
        userTotals: new Map<string, number>()
      }

      const featureEntry = day.features.find((f) => f.feature === feature)
      existing.featureInteractions += featureEntry?.interactions || 0
      existing.totalInteractions += day.total_interactions
      existing.dayCount += 1

      if (featureEntry) {
        for (const u of featureEntry.users) {
          existing.userTotals.set(
            u.login,
            (existing.userTotals.get(u.login) || 0) + u.interactions
          )
        }
      }

      monthData.set(month, existing)
    }

    const months = [...monthData.keys()].sort().reverse()

    markdown += `## Monthly\n\n`
    markdown += `| Month | Feature Interactions | Total Interactions | % of Total | Most Active (top 5) | Least Active (bottom 5) |\n`
    markdown += `| --- | --- | --- | --- | --- | --- |\n`

    for (const month of months) {
      const data = monthData.get(month)!
      const pct =
        data.totalInteractions > 0
          ? Math.round(
              (data.featureInteractions / data.totalInteractions) * 100
            )
          : 0

      const sorted = [...data.userTotals.entries()]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])

      const mostActive = sorted.slice(0, 5).map(([u]) => u)
      const leastActive = sorted
        .slice(-5)
        .reverse()
        .map(([u]) => u)

      markdown += `| ${month} | ${data.featureInteractions} | ${data.totalInteractions} | ${pct}% | ${mostActive.join(', ')} | ${leastActive.join(', ')} |\n`
    }
    markdown += '\n'

    // Weekly table
    const weekData = new Map<
      string,
      {
        featureInteractions: number
        totalInteractions: number
        activeUsers: Set<string>
      }
    >()

    for (const day of days) {
      const week = getISOWeek(day.day)
      const existing = weekData.get(week) || {
        featureInteractions: 0,
        totalInteractions: 0,
        activeUsers: new Set<string>()
      }

      const featureEntry = day.features.find((f) => f.feature === feature)
      existing.featureInteractions += featureEntry?.interactions || 0
      existing.totalInteractions += day.total_interactions

      if (featureEntry) {
        for (const u of featureEntry.users) {
          if (u.interactions > 0) existing.activeUsers.add(u.login)
        }
      }

      weekData.set(week, existing)
    }

    const weeks = [...weekData.keys()].sort().reverse()

    markdown += `## Weekly\n\n`
    markdown += `| Week | Feature Interactions | Total Interactions | % of Total | Active Users |\n`
    markdown += `| --- | --- | --- | --- | --- |\n`

    for (const week of weeks) {
      const data = weekData.get(week)!
      const pct =
        data.totalInteractions > 0
          ? Math.round(
              (data.featureInteractions / data.totalInteractions) * 100
            )
          : 0

      const activeList = [...data.activeUsers].sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      )

      markdown += `| ${week} | ${data.featureInteractions} | ${data.totalInteractions} | ${pct}% | ${activeList.join(', ')} |\n`
    }
    markdown += '\n'

    const slug = feature.replace(/[^a-z0-9-]/g, '-')
    files.push({
      filename: `feature-adoption-${slug}.md`,
      content: markdown
    })
  }

  return files
}
