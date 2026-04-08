/**
 * Generates per-individual-user report files showing feature and model usage.
 * One markdown file per user with usage breakdowns over time.
 */

import * as core from '@actions/core'

import { aggregateUserMetric } from './aggregateUserMetric.js'
import { collapseSmallGroups } from './collapseSmallGroups.js'
import { renderChart } from './renderChart.js'
import type { PeriodType } from './dateToPeriod.js'
import type { ReportFile } from './writeReportFiles.js'

const PERIOD_CONFIGS: Array<{
  type: PeriodType
  maxPeriods: number
  label: string
}> = [
  { type: 'daily', maxPeriods: 14, label: 'Daily (14 days)' },
  { type: 'weekly', maxPeriods: 12, label: 'Weekly (12 weeks)' },
  { type: 'monthly', maxPeriods: 12, label: 'Monthly (12 months)' }
]

const generateUserSection = (
  title: string,
  userFiles: Record<string, unknown>[],
  category: string,
  groupField: string,
  metric: string
): string => {
  let content = ''

  for (const periodConfig of PERIOD_CONFIGS) {
    const aggregated = aggregateUserMetric(
      userFiles,
      category,
      groupField,
      metric,
      periodConfig.type,
      periodConfig.maxPeriods
    )

    if (aggregated.periods.length === 0 || aggregated.groups.length === 0)
      continue

    const hasData = aggregated.groups.some((group) =>
      aggregated.periods.some(
        (period) => (aggregated.values.get(period)?.get(group) || 0) > 0
      )
    )
    if (!hasData) continue

    const series = aggregated.groups.map((group) => ({
      name: group,
      values: aggregated.periods.map(
        (period) => aggregated.values.get(period)?.get(group) || 0
      )
    }))

    const collapsed = collapseSmallGroups(series)

    content += renderChart({
      title: periodConfig.label,
      periodLabels: aggregated.periods,
      series: collapsed.series,
      othersMembers: collapsed.othersMembers
    })
  }

  if (!content) return ''
  return `## ${title}\n\n${content}`
}

export const generateIndividualUserReports = (
  userFiles: Record<string, unknown>[]
): ReportFile[] => {
  const userLogins = [
    ...new Set(
      userFiles
        .map((f) => f.user_login as string)
        .filter(Boolean)
    )
  ].sort()

  if (userLogins.length === 0) return []

  core.info(
    `Generating individual reports for ${userLogins.length} user(s)`
  )

  const files: ReportFile[] = []

  for (const login of userLogins) {
    const filtered = userFiles.filter((f) => f.user_login === login)

    let markdown = `# User Report — ${login}\n\n`
    markdown += `[← Back to Index](README.md)\n\n`

    let hasContent = false

    const featureSection = generateUserSection(
      'Feature Usage',
      filtered,
      'totals_by_feature',
      'feature',
      'user_initiated_interaction_count'
    )
    if (featureSection) {
      markdown += featureSection
      hasContent = true
    }

    const modelSection = generateUserSection(
      'Model Usage',
      filtered,
      'totals_by_model_feature',
      'model',
      'user_initiated_interaction_count'
    )
    if (modelSection) {
      markdown += modelSection
      hasContent = true
    }

    if (hasContent) {
      const slug = login.toLowerCase().replace(/[^a-z0-9-]/g, '-')
      files.push({ filename: `user-${slug}.md`, content: markdown })
    }
  }

  return files
}
