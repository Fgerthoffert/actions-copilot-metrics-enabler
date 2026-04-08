/**
 * Generates a feature adoption report from the transformed feature-interactions.ndjson.
 * Columns: Date/Month, one per feature, Total. Each cell shows count and row percentage.
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import type { ReportFile } from '../report/writeReportFiles.js'

interface FeatureInteractionEntry {
  feature: string
  user_initiated_interaction_count: number
}

interface FeatureInteractionDay {
  day: string
  totals_by_feature: FeatureInteractionEntry[]
}

const loadTransformFile = (
  transformPath: string
): FeatureInteractionDay[] => {
  const filePath = path.join(transformPath, 'feature-interactions.ndjson')
  if (!fs.existsSync(filePath)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as FeatureInteractionDay)
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

  let markdown = `# Feature Adoption — User Initiated Interactions\n\n`
  markdown += `[← Back to Index](README.md)\n\n`

  // Monthly table
  markdown += `## Monthly\n\n`
  markdown += renderTable('Month', months, features, (month) =>
    monthMap.get(month)!
  )

  // Daily table
  markdown += `## Daily\n\n`
  markdown += renderTable(
    'Date',
    days.map((d) => d.day),
    features,
    (day) => {
      const featureMap = new Map<string, number>()
      const dayData = days.find((d) => d.day === day)
      if (dayData) {
        for (const entry of dayData.totals_by_feature) {
          featureMap.set(
            entry.feature,
            (featureMap.get(entry.feature) || 0) +
              entry.user_initiated_interaction_count
          )
        }
      }
      return featureMap
    }
  )

  return [{ filename: 'feature-adoption.md', content: markdown }]
}
