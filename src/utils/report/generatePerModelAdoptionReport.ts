/**
 * Generates per-model adoption reports from the transformed
 * model-adoption.ndjson. One markdown file per model, each with:
 * - Monthly table: model usage vs total, top 5 / bottom 5 users
 * - Daily table: model usage vs total, active users for that model
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import type { ReportFile } from './writeReportFiles.js'

interface UserModelEntry {
  login: string
  interactions: number
}

interface ModelAdoptionEntry {
  model: string
  interactions: number
  users: UserModelEntry[]
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

export const generatePerModelAdoptionReport = (
  transformPath: string
): ReportFile[] => {
  const days = loadTransformFile(transformPath)

  if (days.length === 0) {
    core.info(
      'No model adoption data found, skipping per-model adoption report'
    )
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

  const models = [...modelTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m)

  if (models.length === 0) return []

  const files: ReportFile[] = []

  for (const model of models) {
    let markdown = `# Per Model Adoption — ${model}\n\n`
    markdown += `[← Back to Index](README.md)\n\n`

    // Monthly aggregation
    const monthData = new Map<
      string,
      {
        modelInteractions: number
        totalInteractions: number
        dayCount: number
        userTotals: Map<string, number>
      }
    >()

    for (const day of days) {
      const month = day.day.substring(0, 7)
      const existing = monthData.get(month) || {
        modelInteractions: 0,
        totalInteractions: 0,
        dayCount: 0,
        userTotals: new Map<string, number>()
      }

      const modelEntry = day.models.find((m) => m.model === model)
      existing.modelInteractions += modelEntry?.interactions || 0
      existing.totalInteractions += day.total_interactions
      existing.dayCount += 1

      if (modelEntry) {
        for (const u of modelEntry.users) {
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
    markdown += `| Month | Model Interactions | Total Interactions | % of Total | Most Active (top 5) | Least Active (bottom 5) |\n`
    markdown += `| --- | --- | --- | --- | --- | --- |\n`

    for (const month of months) {
      const data = monthData.get(month)!
      const pct =
        data.totalInteractions > 0
          ? Math.round((data.modelInteractions / data.totalInteractions) * 100)
          : 0

      const sorted = [...data.userTotals.entries()]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])

      const mostActive = sorted.slice(0, 5).map(([u]) => u)
      const leastActive = sorted
        .slice(-5)
        .reverse()
        .map(([u]) => u)

      markdown += `| ${month} | ${data.modelInteractions} | ${data.totalInteractions} | ${pct}% | ${mostActive.join(', ')} | ${leastActive.join(', ')} |\n`
    }
    markdown += '\n'

    // Daily table
    markdown += `## Daily\n\n`
    markdown += `| Date | Model Interactions | Total Interactions | % of Total | Active Users |\n`
    markdown += `| --- | --- | --- | --- | --- |\n`

    for (const day of days) {
      const modelEntry = day.models.find((m) => m.model === model)
      const modelInteractions = modelEntry?.interactions || 0
      const pct =
        day.total_interactions > 0
          ? Math.round((modelInteractions / day.total_interactions) * 100)
          : 0

      const activeUsers = modelEntry
        ? modelEntry.users.filter((u) => u.interactions > 0).map((u) => u.login)
        : []

      markdown += `| ${day.day} | ${modelInteractions} | ${day.total_interactions} | ${pct}% | ${activeUsers.join(', ')} |\n`
    }
    markdown += '\n'

    const slug = model.replace(/[^a-z0-9-]/g, '-')
    files.push({
      filename: `model-adoption-${slug}.md`,
      content: markdown
    })
  }

  return files
}
