/**
 * Generates the users metrics report as a set of markdown files.
 * - IDE usage: distinct user count per IDE
 * - Feature usage: user_initiated_interaction_count per feature
 * - Model usage: user_initiated_interaction_count per model (across all features)
 */

import * as core from '@actions/core'

import { loadUserDailyFiles } from './loadUserDailyFiles.js'
import { aggregateUserCount } from './aggregateUserCount.js'
import { aggregateUserMetric } from './aggregateUserMetric.js'
import { collapseSmallGroups } from './collapseSmallGroups.js'
import { generateAdoptionReport } from './generateAdoptionReport.js'
import { generateIndividualUserReports } from './generateIndividualUserReports.js'
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

const generateSection = (
  title: string,
  periodConfigs: typeof PERIOD_CONFIGS,
  aggregateFn: (
    periodType: PeriodType,
    maxPeriods: number
  ) => {
    periods: string[]
    groups: string[]
    values: Map<string, Map<string, number>>
  }
): string => {
  let content = ''

  for (const periodConfig of periodConfigs) {
    const aggregated = aggregateFn(periodConfig.type, periodConfig.maxPeriods)

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

export const generateUsersReport = (storePath: string): ReportFile[] => {
  const userFiles = loadUserDailyFiles(storePath)

  if (userFiles.length === 0) {
    core.info('No user daily files found, skipping users report')
    return []
  }

  core.info(
    `Generating users report from ${userFiles.length} user daily file(s)`
  )

  const files: ReportFile[] = []

  // IDE Usage — count of distinct users per IDE
  let ideMarkdown = `# Users — IDE Usage\n\n`
  ideMarkdown += `[← Back to Index](README.md)\n\n`
  const ideSection = generateSection(
    'Users per IDE',
    PERIOD_CONFIGS,
    (periodType, maxPeriods) =>
      aggregateUserCount(
        userFiles,
        'totals_by_ide',
        'ide',
        periodType,
        maxPeriods
      )
  )
  if (ideSection) {
    ideMarkdown += ideSection
    files.push({ filename: 'users-by-ide.md', content: ideMarkdown })
  }

  // Feature Usage — user_initiated_interaction_count per feature
  let featureMarkdown = `# Users — Feature Usage\n\n`
  featureMarkdown += `[← Back to Index](README.md)\n\n`
  const featureSection = generateSection(
    'User Initiated Interactions per Feature',
    PERIOD_CONFIGS,
    (periodType, maxPeriods) =>
      aggregateUserMetric(
        userFiles,
        'totals_by_feature',
        'feature',
        'user_initiated_interaction_count',
        periodType,
        maxPeriods
      )
  )
  if (featureSection) {
    featureMarkdown += featureSection
    files.push({ filename: 'users-by-feature.md', content: featureMarkdown })
  }

  // Model Usage — user_initiated_interaction_count per model (across all features)
  let modelMarkdown = `# Users — Model Usage\n\n`
  modelMarkdown += `[← Back to Index](README.md)\n\n`
  const modelSection = generateSection(
    'User Initiated Interactions per Model',
    PERIOD_CONFIGS,
    (periodType, maxPeriods) =>
      aggregateUserMetric(
        userFiles,
        'totals_by_model_feature',
        'model',
        'user_initiated_interaction_count',
        periodType,
        maxPeriods
      )
  )
  if (modelSection) {
    modelMarkdown += modelSection
    files.push({ filename: 'users-by-model.md', content: modelMarkdown })
  }

  // Adoption reports
  const adoptionFiles = generateAdoptionReport(userFiles)
  files.push(...adoptionFiles)

  // Per-individual-user reports
  const individualFiles = generateIndividualUserReports(userFiles)
  files.push(...individualFiles)

  return files
}
