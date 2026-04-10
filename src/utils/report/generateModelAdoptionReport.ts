/**
 * Generates a model adoption overview report from the transformed
 * model-adoption.ndjson. Columns: Date/Month, one per model, Total.
 * Each cell shows count and row percentage.
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import type { ReportFile } from './writeReportFiles.js'

interface ModelAdoptionEntry {
  model: string
  interactions: number
}

interface ModelAdoptionDay {
  day: string
  total_interactions: number
  models: ModelAdoptionEntry[]
}

const loadTransformFile = (transformPath: string): ModelAdoptionDay[] => {
  const filePath = path.join(transformPath, 'model-adoption.ndjson')
  if (!fs.existsSync(filePath)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ModelAdoptionDay)
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

const renderTable = (
  periodLabel: string,
  periods: string[],
  models: string[],
  getModelMap: (period: string) => Map<string, number>
): string => {
  const headers = [periodLabel, ...models, 'Total']
  const separator = headers.map(() => '---')

  const rows = periods.map((period) => {
    const modelMap = getModelMap(period)
    const total = [...modelMap.values()].reduce((a, b) => a + b, 0)

    const cells = models.map((model) => {
      const val = modelMap.get(model) || 0
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

export const generateModelAdoptionReport = (
  transformPath: string
): ReportFile[] => {
  const days = loadTransformFile(transformPath)

  if (days.length === 0) {
    core.info('No model adoption data found, skipping model adoption report')
    return []
  }

  // Collect all unique models, ordered by total interactions descending
  const modelTotals = new Map<string, number>()
  for (const day of days) {
    for (const entry of day.models) {
      modelTotals.set(
        entry.model,
        (modelTotals.get(entry.model) || 0) + entry.interactions
      )
    }
  }

  const grandTotal = [...modelTotals.values()].reduce((a, b) => a + b, 0)
  const threshold = 0.05

  const keptModels: string[] = []
  const othersMembers: string[] = []

  for (const [model, total] of [...modelTotals.entries()].sort(
    (a, b) => b[1] - a[1]
  )) {
    if (grandTotal > 0 && total / grandTotal < threshold) {
      othersMembers.push(model)
    } else {
      keptModels.push(model)
    }
  }

  const models =
    othersMembers.length > 0 ? [...keptModels, 'Others'] : keptModels

  if (models.length === 0) return []

  /** Collapse a raw model→value map into one with "Others" merged */
  const collapseMap = (raw: Map<string, number>): Map<string, number> => {
    const result = new Map<string, number>()
    let othersVal = 0
    for (const [model, val] of raw) {
      if (othersMembers.includes(model)) {
        othersVal += val
      } else {
        result.set(model, (result.get(model) || 0) + val)
      }
    }
    if (othersMembers.length > 0) {
      result.set('Others', (result.get('Others') || 0) + othersVal)
    }
    return result
  }

  // Aggregate by month
  const monthMap = new Map<string, Map<string, number>>()
  for (const day of days) {
    const month = day.day.substring(0, 7)
    if (!monthMap.has(month)) monthMap.set(month, new Map())
    const mModelMap = monthMap.get(month)!
    for (const entry of day.models) {
      mModelMap.set(
        entry.model,
        (mModelMap.get(entry.model) || 0) + entry.interactions
      )
    }
  }

  const months = [...monthMap.keys()].sort().reverse()

  let markdown = `# Model Adoption — User Initiated Interactions\n\n`
  markdown += `[← Back to Index](README.md)\n\n`

  // Monthly table
  markdown += `## Monthly\n\n`
  markdown += renderTable('Month', months, models, (month) =>
    collapseMap(monthMap.get(month)!)
  )
  if (othersMembers.length > 0) {
    markdown += `*Others: models individually representing less than 5% of total usage (${othersMembers.join(', ')})*\n\n`
  }

  // Weekly table — show all models without collapsing
  const allModels = [...modelTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([model]) => model)

  const weekMap = new Map<string, Map<string, number>>()
  for (const day of days) {
    const week = getISOWeek(day.day)
    if (!weekMap.has(week)) weekMap.set(week, new Map())
    const wModelMap = weekMap.get(week)!
    for (const entry of day.models) {
      wModelMap.set(
        entry.model,
        (wModelMap.get(entry.model) || 0) + entry.interactions
      )
    }
  }

  const weeks = [...weekMap.keys()].sort().reverse()

  markdown += `## Weekly\n\n`
  markdown += renderTable(
    'Week',
    weeks,
    allModels,
    (week) => weekMap.get(week)!
  )

  return [{ filename: 'model-adoption.md', content: markdown }]
}
