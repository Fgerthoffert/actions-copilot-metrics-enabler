/**
 * Transform: reads organization source daily JSON files and cross-references
 * with users source data to produce an NDJSON file with per-feature adoption
 * data, one line per day (most recent first).
 * Each line: { day, total_interactions, features: [{ feature, interactions,
 *              users: [{ login, interactions }] }] }
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import { loadDailyFiles } from '../loadDailyFiles.js'
import { loadUserDailyFiles } from '../loadUserDailyFiles.js'

interface UserFeatureEntry {
  login: string
  interactions: number
}

interface FeatureAdoptionEntry {
  feature: string
  interactions: number
  users: UserFeatureEntry[]
}

interface FeatureAdoptionDay {
  day: string
  total_interactions: number
  features: FeatureAdoptionEntry[]
}

export const transformFeatureAdoption = (
  sourcePath: string,
  transformPath: string,
  usersSourcePath: string
): void => {
  const dailyFiles = loadDailyFiles(sourcePath)

  if (dailyFiles.length === 0) {
    core.info(
      'No organization source files found, skipping feature adoption transform'
    )
    return
  }

  // Build day → feature → user → interactions from users source
  const userFiles = loadUserDailyFiles(usersSourcePath)
  const dayFeatureUsers = new Map<
    string,
    Map<string, Map<string, number>>
  >()

  for (const file of userFiles) {
    const day = file.day as string
    const login = file.user_login as string
    if (!day || !login) continue

    const items = file.totals_by_feature as
      | Array<Record<string, unknown>>
      | undefined
    if (!Array.isArray(items)) continue

    if (!dayFeatureUsers.has(day)) dayFeatureUsers.set(day, new Map())
    const featureMap = dayFeatureUsers.get(day)!

    for (const item of items) {
      const feature = String(item.feature || 'unknown')
      const count = (item.user_initiated_interaction_count as number) || 0

      if (!featureMap.has(feature)) featureMap.set(feature, new Map())
      const userMap = featureMap.get(feature)!
      userMap.set(login, (userMap.get(login) || 0) + count)
    }
  }

  const transformed: FeatureAdoptionDay[] = dailyFiles
    .filter((file) => file.day && Array.isArray(file.totals_by_feature))
    .map((file) => {
      const day = file.day as string
      const orgFeatures = file.totals_by_feature as Array<
        Record<string, unknown>
      >
      const totalInteractions =
        (file.user_initiated_interaction_count as number) || 0

      const featureUsers = dayFeatureUsers.get(day) || new Map()

      const features: FeatureAdoptionEntry[] = orgFeatures.map((item) => {
        const feature = String(item.feature || 'unknown')
        const interactions =
          (item.user_initiated_interaction_count as number) || 0

        const userMap = featureUsers.get(feature) || new Map()
        const users = [...userMap.entries()]
          .map(([login, count]) => ({ login, interactions: count }))
          .sort((a, b) => b.interactions - a.interactions)

        return { feature, interactions, users }
      })

      return { day, total_interactions: totalInteractions, features }
    })
    .sort((a, b) => b.day.localeCompare(a.day))

  if (!fs.existsSync(transformPath)) {
    fs.mkdirSync(transformPath, { recursive: true })
  }

  const outputFile = path.join(transformPath, 'feature-adoption.ndjson')
  const ndjson = transformed.map((entry) => JSON.stringify(entry)).join('\n')
  fs.writeFileSync(outputFile, ndjson, 'utf-8')

  core.info(`Wrote ${transformed.length} day(s) to ${outputFile}`)
}
