/**
 * Transform: reads per-user source data and aggregates per-model adoption
 * data, one line per day (most recent first).
 * Aggregates totals_by_model_feature by model name (summing across features).
 * Each line: { day, total_interactions, models: [{ model, interactions,
 *              users: [{ login, interactions }] }] }
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import { loadUserDailyFiles } from '../loadUserDailyFiles.js'

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

export const transformModelAdoption = (
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
    core.info('No user source files found, skipping model adoption transform')
    return
  }

  // Build day → model → user → interactions
  const dayModelUsers = new Map<string, Map<string, Map<string, number>>>()

  for (const file of userFiles) {
    const day = file.day as string
    const login = file.user_login as string
    if (!day || !login) continue

    const items = file.totals_by_model_feature as
      | Array<Record<string, unknown>>
      | undefined
    if (!Array.isArray(items)) continue

    if (!dayModelUsers.has(day)) dayModelUsers.set(day, new Map())
    const modelMap = dayModelUsers.get(day)!

    for (const item of items) {
      const model = String(item.model || 'unknown')
      const count = (item.user_initiated_interaction_count as number) || 0

      if (!modelMap.has(model)) modelMap.set(model, new Map())
      const userMap = modelMap.get(model)!
      userMap.set(login, (userMap.get(login) || 0) + count)
    }
  }

  const transformed: ModelAdoptionDay[] = [...dayModelUsers.entries()]
    .map(([day, modelMap]) => {
      let totalInteractions = 0

      const models: ModelAdoptionEntry[] = [...modelMap.entries()]
        .map(([model, userMap]) => {
          const interactions = [...userMap.values()].reduce(
            (sum, v) => sum + v,
            0
          )
          totalInteractions += interactions

          const users = [...userMap.entries()]
            .map(([login, count]) => ({ login, interactions: count }))
            .sort((a, b) => b.interactions - a.interactions)

          return { model, interactions, users }
        })
        .sort((a, b) => b.interactions - a.interactions)

      return { day, total_interactions: totalInteractions, models }
    })
    .sort((a, b) => b.day.localeCompare(a.day))

  if (!fs.existsSync(transformPath)) {
    fs.mkdirSync(transformPath, { recursive: true })
  }

  const outputFile = path.join(transformPath, 'model-adoption.ndjson')
  const ndjson = transformed.map((entry) => JSON.stringify(entry)).join('\n')
  fs.writeFileSync(outputFile, ndjson, 'utf-8')

  core.info(`Wrote ${transformed.length} day(s) to ${outputFile}`)
}
