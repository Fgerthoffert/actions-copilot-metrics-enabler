/**
 * Generates an IDE adoption report from the transformed ide-interactions.ndjson.
 * Columns: Date, one per IDE, Total. Each cell shows count and row percentage.
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import type { ReportFile } from './writeReportFiles.js'

interface IdeInteractionEntry {
  ide: string
  user_initiated_interaction_count: number
}

interface IdeInteractionDay {
  day: string
  totals_by_ide: IdeInteractionEntry[]
}

const loadTransformFile = (transformPath: string): IdeInteractionDay[] => {
  const filePath = path.join(transformPath, 'ide-interactions.ndjson')
  if (!fs.existsSync(filePath)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as IdeInteractionDay)
}

export const generateIdeAdoptionReport = (
  transformPath: string
): ReportFile[] => {
  const days = loadTransformFile(transformPath)

  if (days.length === 0) {
    core.info('No IDE interaction data found, skipping IDE adoption report')
    return []
  }

  // Collect all unique IDE names, ordered by total interactions descending
  const ideTotals = new Map<string, number>()
  for (const day of days) {
    for (const entry of day.totals_by_ide) {
      ideTotals.set(
        entry.ide,
        (ideTotals.get(entry.ide) || 0) + entry.user_initiated_interaction_count
      )
    }
  }

  const ides = [...ideTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([ide]) => ide)

  if (ides.length === 0) return []

  // Aggregate by month (YYYY-MM), most recent first
  const monthMap = new Map<string, Map<string, number>>()
  for (const day of days) {
    const month = day.day.substring(0, 7)
    if (!monthMap.has(month)) monthMap.set(month, new Map())
    const mIdeMap = monthMap.get(month)!
    for (const entry of day.totals_by_ide) {
      mIdeMap.set(
        entry.ide,
        (mIdeMap.get(entry.ide) || 0) + entry.user_initiated_interaction_count
      )
    }
  }

  const months = [...monthMap.keys()].sort().reverse()

  let markdown = `# IDE Adoption — User Initiated Interactions\n\n`
  markdown += `[← Back to Index](README.md)\n\n`

  // Monthly table
  markdown += `## Monthly\n\n`
  markdown += renderTable(
    'Month',
    months,
    ides,
    (month) => monthMap.get(month)!
  )

  // Daily table
  markdown += `## Daily\n\n`
  markdown += renderTable(
    'Date',
    days.map((d) => d.day),
    ides,
    (day) => {
      const ideMap = new Map<string, number>()
      const dayData = days.find((d) => d.day === day)
      if (dayData) {
        for (const entry of dayData.totals_by_ide) {
          ideMap.set(
            entry.ide,
            (ideMap.get(entry.ide) || 0) +
              entry.user_initiated_interaction_count
          )
        }
      }
      return ideMap
    }
  )

  return [{ filename: 'ide-adoption.md', content: markdown }]
}

const renderTable = (
  periodLabel: string,
  periods: string[],
  ides: string[],
  getIdeMap: (period: string) => Map<string, number>
): string => {
  const headers = [periodLabel, ...ides, 'Total']
  const separator = headers.map(() => '---')

  const rows = periods.map((period) => {
    const ideMap = getIdeMap(period)
    const total = [...ideMap.values()].reduce((a, b) => a + b, 0)

    const cells = ides.map((ide) => {
      const val = ideMap.get(ide) || 0
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
