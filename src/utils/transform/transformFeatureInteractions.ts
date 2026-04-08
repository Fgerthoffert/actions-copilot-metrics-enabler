/**
 * Transform: reads organization source daily JSON files and produces
 * an NDJSON file with feature interaction data, one line per day (most recent first).
 * Each line: { day, totals_by_feature: [{ feature, user_initiated_interaction_count }] }
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import { loadDailyFiles } from '../loadDailyFiles.js'

interface FeatureInteractionEntry {
  feature: string
  user_initiated_interaction_count: number
}

interface FeatureInteractionDay {
  day: string
  totals_by_feature: FeatureInteractionEntry[]
}

export const transformFeatureInteractions = (
  sourcePath: string,
  transformPath: string
): void => {
  const dailyFiles = loadDailyFiles(sourcePath)

  if (dailyFiles.length === 0) {
    core.info('No organization source files found, skipping feature transform')
    return
  }

  const transformed: FeatureInteractionDay[] = dailyFiles
    .filter((file) => file.day && Array.isArray(file.totals_by_feature))
    .map((file) => {
      const items = file.totals_by_feature as Array<Record<string, unknown>>
      return {
        day: file.day as string,
        totals_by_feature: items.map((item) => ({
          feature: String(item.feature || 'unknown'),
          user_initiated_interaction_count:
            (item.user_initiated_interaction_count as number) || 0
        }))
      }
    })
    .sort((a, b) => b.day.localeCompare(a.day))

  if (!fs.existsSync(transformPath)) {
    fs.mkdirSync(transformPath, { recursive: true })
  }

  const outputFile = path.join(transformPath, 'feature-interactions.ndjson')
  const ndjson = transformed.map((entry) => JSON.stringify(entry)).join('\n')
  fs.writeFileSync(outputFile, ndjson, 'utf-8')

  core.info(`Wrote ${transformed.length} day(s) to ${outputFile}`)
}
