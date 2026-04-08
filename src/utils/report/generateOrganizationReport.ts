/**
 * Generates the organization metrics report as a set of markdown files.
 * One file per category, with all periods and metrics in each.
 */

import * as core from '@actions/core'

import { loadDailyFiles } from './loadDailyFiles.js'
import { aggregateCategory } from './aggregateCategory.js'
import { collapseSmallGroups } from './collapseSmallGroups.js'
import { renderChart } from './renderChart.js'
import type { PeriodType } from './dateToPeriod.js'
import type { ReportFile } from './writeReportFiles.js'

const CATEGORIES: Array<{ key: string; label: string; slug: string }> = [
  { key: 'totals_by_ide', label: 'By IDE', slug: 'org-by-ide' },
  { key: 'totals_by_feature', label: 'By Feature', slug: 'org-by-feature' },
  {
    key: 'totals_by_language_feature',
    label: 'By Language & Feature',
    slug: 'org-by-language-feature'
  },
  {
    key: 'totals_by_language_model',
    label: 'By Language & Model',
    slug: 'org-by-language-model'
  },
  {
    key: 'totals_by_model_feature',
    label: 'By Model & Feature',
    slug: 'org-by-model-feature'
  }
]

const METRICS: Array<{ key: string; label: string }> = [
  { key: 'code_generation_activity_count', label: 'Code Generation Activity' },
  { key: 'code_acceptance_activity_count', label: 'Code Acceptance Activity' },
  {
    key: 'user_initiated_interaction_count',
    label: 'User Initiated Interactions'
  },
  { key: 'loc_suggested_to_add_sum', label: 'LOC Suggested to Add' },
  { key: 'loc_suggested_to_delete_sum', label: 'LOC Suggested to Delete' },
  { key: 'loc_added_sum', label: 'LOC Added' },
  { key: 'loc_deleted_sum', label: 'LOC Deleted' }
]

const PERIOD_CONFIGS: Array<{
  type: PeriodType
  maxPeriods: number
  label: string
}> = [
  { type: 'daily', maxPeriods: 30, label: 'Daily (30 days)' },
  { type: 'weekly', maxPeriods: 30, label: 'Weekly (30 weeks)' },
  { type: 'monthly', maxPeriods: 30, label: 'Monthly (30 months)' }
]

export const generateOrganizationReport = (
  storePath: string
): ReportFile[] => {
  const dailyFiles = loadDailyFiles(storePath)

  if (dailyFiles.length === 0) {
    core.info('No organization daily files found, skipping report')
    return []
  }

  core.info(
    `Generating organization report from ${dailyFiles.length} daily file(s)`
  )

  const files: ReportFile[] = []

  for (const category of CATEGORIES) {
    let markdown = `# Organization — ${category.label}\n\n`
    markdown += `[← Back to Index](README.md)\n\n`

    let hasContent = false

    for (const metric of METRICS) {
      let metricContent = ''

      for (const periodConfig of PERIOD_CONFIGS) {
        const aggregated = aggregateCategory(
          dailyFiles,
          category.key,
          metric.key,
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

        metricContent += renderChart({
          title: periodConfig.label,
          periodLabels: aggregated.periods,
          series: collapsed.series,
          othersMembers: collapsed.othersMembers
        })
      }

      if (metricContent) {
        markdown += `## ${metric.label}\n\n${metricContent}`
        hasContent = true
      }
    }

    if (hasContent) {
      files.push({ filename: `${category.slug}.md`, content: markdown })
    }
  }

  return files
}
