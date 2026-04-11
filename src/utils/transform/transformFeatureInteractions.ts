/**
 * Transform: reads per-user source data and aggregates feature interaction
 * counts to produce an NDJSON file with feature interaction data, one line
 * per day (most recent first).
 * Each line: { day, totals_by_feature: [{ feature, user_initiated_interaction_count }] }
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import { loadUserDailyFiles } from '../loadUserDailyFiles.js'

interface FeatureInteractionEntry {
  feature: string
  user_initiated_interaction_count: number
}

interface FeatureInteractionDay {
  day: string
  totals_by_feature: FeatureInteractionEntry[]
}

export const transformFeatureInteractions = (
  usersSourcePath: string,
  transformPath: string,
  includeUsers: string[] = [],
  excludeUsers: string[] = []
): void => {
  const userFiles = loadUserDailyFiles(
    usersSourcePath,
    includeUsers,
    excludeUsers
  )

  if (userFiles.length === 0) {
    core.info('No user source files found, skipping feature transform')
    return
  }

  // Group by day, then aggregate feature interactions
  const dayFeatureMap = new Map<string, Map<string, number>>()

  for (const file of userFiles) {
    const day = file.day as string
    if (!day) continue

    const items = file.totals_by_feature as
      | Array<Record<string, unknown>>
      | undefined
    if (!Array.isArray(items)) continue

    if (!dayFeatureMap.has(day)) dayFeatureMap.set(day, new Map())
    const featureMap = dayFeatureMap.get(day)!

    for (const item of items) {
      const feature = String(item.feature || 'unknown')
      const count = (item.user_initiated_interaction_count as number) || 0
      featureMap.set(feature, (featureMap.get(feature) || 0) + count)
    }
  }

  const transformed: FeatureInteractionDay[] = [...dayFeatureMap.entries()]
    .map(([day, featureMap]) => ({
      day,
      totals_by_feature: [...featureMap.entries()]
        .map(([feature, user_initiated_interaction_count]) => ({
          feature,
          user_initiated_interaction_count
        }))
        .sort(
          (a, b) =>
            b.user_initiated_interaction_count -
            a.user_initiated_interaction_count
        )
    }))
    .sort((a, b) => b.day.localeCompare(a.day))

  if (!fs.existsSync(transformPath)) {
    fs.mkdirSync(transformPath, { recursive: true })
  }

  const outputFile = path.join(transformPath, 'feature-interactions.ndjson')
  const ndjson = transformed.map((entry) => JSON.stringify(entry)).join('\n')
  fs.writeFileSync(outputFile, ndjson, 'utf-8')

  core.info(`Wrote ${transformed.length} day(s) to ${outputFile}`)
}
