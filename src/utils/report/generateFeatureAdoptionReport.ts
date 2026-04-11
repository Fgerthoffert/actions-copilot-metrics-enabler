/**
 * Generates a feature adoption report from the transformed feature-interactions.ndjson.
 * Columns: Date/Month, one per feature, Total. Each cell shows count and row percentage.
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import type { ReportFile } from './writeReportFiles.js'

interface FeatureInteractionEntry {
  feature: string
  user_initiated_interaction_count: number
}

interface FeatureInteractionDay {
  day: string
  totals_by_feature: FeatureInteractionEntry[]
}

const loadTransformFile = (transformPath: string): FeatureInteractionDay[] => {
  const filePath = path.join(transformPath, 'feature-interactions.ndjson')
  if (!fs.existsSync(filePath)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as FeatureInteractionDay)
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

const renderFeatureLegend = (features: string[]): string => {
  let legend = `## Feature Legend\n\n`
  legend += `| Feature | Description |\n`
  legend += `| --- | --- |\n`
  for (const f of features) {
    const desc = FEATURE_DESCRIPTIONS[f] || 'No description available.'
    legend += `| ${f} | ${desc} |\n`
  }
  legend += '\n'
  return legend
}

const renderTable = (
  periodLabel: string,
  periods: string[],
  features: string[],
  getFeatureMap: (period: string) => Map<string, number>
): string => {
  const headers = [periodLabel, ...features, 'Total']
  const separator = headers.map(() => '---')

  const rows = periods.map((period) => {
    const featureMap = getFeatureMap(period)
    const total = [...featureMap.values()].reduce((a, b) => a + b, 0)

    const cells = features.map((feature) => {
      const val = featureMap.get(feature) || 0
      if (val === 0) return '0'
      const pct = total > 0 ? Math.round((val / total) * 100) : 0
      return `${val} (${pct}%)`
    })

    return `| ${period} | ${cells.join(' | ')} | **${total}** |`
  })

  return (
    `| ${headers.join(' | ')} |\n` +
    `| ${separator.join(' | ')} |\n` +
    rows.join('\n') +
    '\n\n'
  )
}

export const generateFeatureAdoptionReport = (
  transformPath: string
): ReportFile[] => {
  const days = loadTransformFile(transformPath)

  if (days.length === 0) {
    core.info(
      'No feature interaction data found, skipping feature adoption report'
    )
    return []
  }

  // Collect all unique features, ordered by total interactions descending
  const featureTotals = new Map<string, number>()
  for (const day of days) {
    for (const entry of day.totals_by_feature) {
      featureTotals.set(
        entry.feature,
        (featureTotals.get(entry.feature) || 0) +
          entry.user_initiated_interaction_count
      )
    }
  }

  const features = [...featureTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f)

  if (features.length === 0) return []

  // Aggregate by month (YYYY-MM), most recent first
  const monthMap = new Map<string, Map<string, number>>()
  for (const day of days) {
    const month = day.day.substring(0, 7)
    if (!monthMap.has(month)) monthMap.set(month, new Map())
    const mFeatureMap = monthMap.get(month)!
    for (const entry of day.totals_by_feature) {
      mFeatureMap.set(
        entry.feature,
        (mFeatureMap.get(entry.feature) || 0) +
          entry.user_initiated_interaction_count
      )
    }
  }

  const months = [...monthMap.keys()].sort().reverse()

  // Aggregate by ISO week, most recent first
  const weekMap = new Map<string, Map<string, number>>()
  for (const day of days) {
    const week = getISOWeek(day.day)
    if (!weekMap.has(week)) weekMap.set(week, new Map())
    const wFeatureMap = weekMap.get(week)!
    for (const entry of day.totals_by_feature) {
      wFeatureMap.set(
        entry.feature,
        (wFeatureMap.get(entry.feature) || 0) +
          entry.user_initiated_interaction_count
      )
    }
  }

  const weeks = [...weekMap.keys()].sort().reverse()

  let markdown = `# Feature Adoption — User Initiated Interactions\n\n`
  markdown += `[← Back to Index](README.md)\n\n`
  markdown += renderFeatureLegend(features)

  // Monthly table
  markdown += `## Monthly\n\n`
  markdown += renderTable(
    'Month',
    months,
    features,
    (month) => monthMap.get(month)!
  )

  // Weekly table
  markdown += `## Weekly\n\n`
  markdown += renderTable('Week', weeks, features, (week) => weekMap.get(week)!)

  return [{ filename: 'feature-adoption.md', content: markdown }]
}
