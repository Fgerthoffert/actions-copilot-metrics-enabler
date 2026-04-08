/**
 * Transform: reads organization source daily JSON files and cross-references
 * with users source data to produce an NDJSON file with per-model adoption
 * data, one line per day (most recent first).
 * Aggregates totals_by_model_feature by model name (summing across features).
 * Each line: { day, total_interactions, models: [{ model, interactions,
 *              users: [{ login, interactions }] }] }
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import { loadDailyFiles } from '../report/loadDailyFiles.js'
import { loadUserDailyFiles } from '../report/loadUserDailyFiles.js'

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
  sourcePath: string,
  transformPath: string,
  usersSourcePath: string
): void => {
  const dailyFiles = loadDailyFiles(sourcePath)

  if (dailyFiles.length === 0) {
    core.info(
      'No organization source files found, skipping model adoption transform'
    )
    return
  }

  // Build day → model → user → interactions from users source
  const userFiles = loadUserDailyFiles(usersSourcePath)
  const dayModelUsers = new Map<
    string,
    Map<string, Map<string, number>>
  >()

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

  const transformed: ModelAdoptionDay[] = dailyFiles
    .filter((file) => file.day && Array.isArray(file.totals_by_model_feature))
    .map((file) => {
      const day = file.day as string
      const orgItems = file.totals_by_model_feature as Array<
        Record<string, unknown>
      >
      const totalInteractions =
        (file.user_initiated_interaction_count as number) || 0

      // Aggregate org data by model
      const orgModelMap = new Map<string, number>()
      for (const item of orgItems) {
        const model = String(item.model || 'unknown')
        const count = (item.user_initiated_interaction_count as number) || 0
        orgModelMap.set(model, (orgModelMap.get(model) || 0) + count)
      }

      const modelUsers = dayModelUsers.get(day) || new Map()

      const models: ModelAdoptionEntry[] = [...orgModelMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([model, interactions]) => {
          const userMap = modelUsers.get(model) || new Map()
          const users = [...userMap.entries()]
            .map(([login, count]) => ({ login, interactions: count }))
            .sort((a, b) => b.interactions - a.interactions)

          return { model, interactions, users }
        })

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
