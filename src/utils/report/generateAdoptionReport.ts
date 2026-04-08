/**
 * Generates adoption-focused reports showing which users are using which
 * features and models. Designed to support enablement by highlighting
 * gaps in adoption across teams.
 *
 * Produces:
 * - Feature adoption matrix (users × features, last 28 days)
 * - Model adoption matrix (users × models, last 28 days)
 * - Feature adoption trend (weekly % of active users per feature)
 * - Model adoption trend (weekly % of active users per model)
 */

import * as core from '@actions/core'

import { dateToPeriod } from './dateToPeriod.js'
import { collapseSmallGroups } from './collapseSmallGroups.js'
import { renderChart } from './renderChart.js'
import type { PeriodType } from './dateToPeriod.js'
import type { ReportFile } from './writeReportFiles.js'

interface AdoptionMatrix {
  users: string[]
  groups: string[]
  /** user → group → total interaction count */
  values: Map<string, Map<string, number>>
  /** user → number of distinct active days */
  activeDays: Map<string, number>
}

const RECENT_DAYS = 28

const buildAdoptionMatrix = (
  userFiles: Record<string, unknown>[],
  category: string,
  groupField: string,
  metric: string
): AdoptionMatrix => {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - RECENT_DAYS)
  const cutoffStr = cutoff.toISOString().substring(0, 10)

  const userGroupValues = new Map<string, Map<string, number>>()
  const userDays = new Map<string, Set<string>>()
  const groupTotals = new Map<string, number>()

  for (const file of userFiles) {
    const day = file.day as string
    const login = file.user_login as string
    if (!day || !login || day < cutoffStr) continue

    const items = file[category] as Record<string, unknown>[] | undefined
    if (!Array.isArray(items)) continue

    if (!userDays.has(login)) userDays.set(login, new Set())
    userDays.get(login)!.add(day)

    if (!userGroupValues.has(login)) userGroupValues.set(login, new Map())
    const groupMap = userGroupValues.get(login)!

    for (const item of items) {
      const group = String(item[groupField] || 'unknown')
      const value = (item[metric] as number) || 0
      groupMap.set(group, (groupMap.get(group) || 0) + value)
      groupTotals.set(group, (groupTotals.get(group) || 0) + value)
    }
  }

  const groups = [...groupTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g)

  const users = [...userGroupValues.entries()]
    .map(([login, gm]) => ({
      login,
      total: [...gm.values()].reduce((a, b) => a + b, 0)
    }))
    .sort((a, b) => b.total - a.total)
    .map((u) => u.login)

  const activeDays = new Map<string, number>()
  for (const [login, days] of userDays) {
    activeDays.set(login, days.size)
  }

  return { users, groups, values: userGroupValues, activeDays }
}

const renderAdoptionMatrix = (
  matrix: AdoptionMatrix,
  title: string
): string => {
  if (matrix.users.length === 0 || matrix.groups.length === 0) return ''

  const headers = ['User', ...matrix.groups, 'Total', 'Active Days']
  const separator = headers.map(() => '---')

  const rows = matrix.users.map((user) => {
    const gm = matrix.values.get(user) || new Map()
    const total = [...gm.values()].reduce((a, b) => a + b, 0)
    const days = matrix.activeDays.get(user) || 0

    const cells = matrix.groups.map((group) => {
      const val = gm.get(group) || 0
      return val > 0 ? `${val}` : '-'
    })

    return `| ${user} | ${cells.join(' | ')} | **${total}** | ${days} |`
  })

  // Adoption row: % of users that have >0 for each group
  const adoptionCells = matrix.groups.map((group) => {
    const usersWithGroup = matrix.users.filter(
      (u) => (matrix.values.get(u)?.get(group) || 0) > 0
    ).length
    const pct = Math.round((usersWithGroup / matrix.users.length) * 100)
    return `**${pct}%** (${usersWithGroup}/${matrix.users.length})`
  })

  const adoptionRow = `| **Adoption** | ${adoptionCells.join(' | ')} | | |`

  return [
    `<details><summary>${title} (last ${RECENT_DAYS} days)</summary>`,
    '',
    `| ${headers.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...rows,
    adoptionRow,
    '',
    '</details>',
    ''
  ].join('\n')
}

interface AdoptionTrend {
  periods: string[]
  groups: string[]
  /** period → group → % of active users */
  rates: Map<string, Map<string, number>>
}

const buildAdoptionTrend = (
  userFiles: Record<string, unknown>[],
  category: string,
  groupField: string,
  periodType: PeriodType,
  maxPeriods: number
): AdoptionTrend => {
  // period → set of all active users
  const periodAllUsers = new Map<string, Set<string>>()
  // period → group → set of users
  const periodGroupUsers = new Map<string, Map<string, Set<string>>>()

  for (const file of userFiles) {
    const day = file.day as string
    const login = file.user_login as string
    if (!day || !login) continue

    const period = dateToPeriod(day, periodType)

    if (!periodAllUsers.has(period)) periodAllUsers.set(period, new Set())
    periodAllUsers.get(period)!.add(login)

    const items = file[category] as Record<string, unknown>[] | undefined
    if (!Array.isArray(items)) continue

    if (!periodGroupUsers.has(period))
      periodGroupUsers.set(period, new Map())
    const groupMap = periodGroupUsers.get(period)!

    for (const item of items) {
      const group = String(item[groupField] || 'unknown')
      if (!groupMap.has(group)) groupMap.set(group, new Set())
      groupMap.get(group)!.add(login)
    }
  }

  const periods = [...periodAllUsers.keys()].sort().slice(-maxPeriods)

  // Rank groups by overall adoption
  const groupTotalAdoptions = new Map<string, number>()
  for (const period of periods) {
    const groupMap = periodGroupUsers.get(period) || new Map()
    for (const [group, users] of groupMap) {
      groupTotalAdoptions.set(
        group,
        (groupTotalAdoptions.get(group) || 0) + users.size
      )
    }
  }
  const groups = [...groupTotalAdoptions.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([g]) => g)

  const rates = new Map<string, Map<string, number>>()
  for (const period of periods) {
    const totalUsers = periodAllUsers.get(period)?.size || 0
    const groupMap = periodGroupUsers.get(period) || new Map()
    const rateMap = new Map<string, number>()

    for (const group of groups) {
      const groupUsers = groupMap.get(group)?.size || 0
      rateMap.set(
        group,
        totalUsers > 0 ? Math.round((groupUsers / totalUsers) * 100) : 0
      )
    }
    rates.set(period, rateMap)
  }

  return { periods, groups, rates }
}

const TREND_CONFIGS: Array<{
  type: PeriodType
  maxPeriods: number
  label: string
}> = [
  { type: 'weekly', maxPeriods: 12, label: 'Weekly (12 weeks)' },
  { type: 'monthly', maxPeriods: 12, label: 'Monthly (12 months)' }
]

const renderAdoptionTrend = (
  userFiles: Record<string, unknown>[],
  category: string,
  groupField: string,
  sectionTitle: string
): string => {
  let content = ''

  for (const config of TREND_CONFIGS) {
    const trend = buildAdoptionTrend(
      userFiles,
      category,
      groupField,
      config.type,
      config.maxPeriods
    )
    if (trend.periods.length === 0 || trend.groups.length === 0) continue

    const series = trend.groups.map((group) => ({
      name: group,
      values: trend.periods.map(
        (period) => trend.rates.get(period)?.get(group) || 0
      )
    }))

    const collapsed = collapseSmallGroups(series)

    content += renderChart({
      title: `${config.label} — % of active users`,
      periodLabels: trend.periods,
      series: collapsed.series,
      othersMembers: collapsed.othersMembers
    })
  }

  if (!content) return ''
  return `## ${sectionTitle}\n\n${content}`
}

export const generateAdoptionReport = (
  userFiles: Record<string, unknown>[]
): ReportFile[] => {
  if (userFiles.length === 0) return []

  core.info('Generating adoption reports')

  const files: ReportFile[] = []

  // Feature adoption
  let featureMd = `# Adoption — Features\n\n`
  featureMd += `[← Back to Index](README.md)\n\n`
  let featureHasContent = false

  const featureMatrix = buildAdoptionMatrix(
    userFiles,
    'totals_by_feature',
    'feature',
    'user_initiated_interaction_count'
  )
  const featureMatrixMd = renderAdoptionMatrix(
    featureMatrix,
    'Feature Adoption Matrix'
  )
  if (featureMatrixMd) {
    featureMd += `## Adoption Matrix\n\n${featureMatrixMd}`
    featureHasContent = true
  }

  const featureTrend = renderAdoptionTrend(
    userFiles,
    'totals_by_feature',
    'feature',
    'Adoption Trend'
  )
  if (featureTrend) {
    featureMd += featureTrend
    featureHasContent = true
  }

  if (featureHasContent) {
    files.push({ filename: 'adoption-features.md', content: featureMd })
  }

  // Model adoption
  let modelMd = `# Adoption — Models\n\n`
  modelMd += `[← Back to Index](README.md)\n\n`
  let modelHasContent = false

  const modelMatrix = buildAdoptionMatrix(
    userFiles,
    'totals_by_model_feature',
    'model',
    'user_initiated_interaction_count'
  )
  const modelMatrixMd = renderAdoptionMatrix(modelMatrix, 'Model Adoption Matrix')
  if (modelMatrixMd) {
    modelMd += `## Adoption Matrix\n\n${modelMatrixMd}`
    modelHasContent = true
  }

  const modelTrend = renderAdoptionTrend(
    userFiles,
    'totals_by_model_feature',
    'model',
    'Adoption Trend'
  )
  if (modelTrend) {
    modelMd += modelTrend
    modelHasContent = true
  }

  if (modelHasContent) {
    files.push({ filename: 'adoption-models.md', content: modelMd })
  }

  return files
}
