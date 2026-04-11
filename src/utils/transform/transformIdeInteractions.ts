/**
 * Transform: reads per-user source data and aggregates IDE interaction counts
 * to produce an NDJSON file with IDE interaction data, one line per day
 * (most recent first).
 * Each line: { day, totals_by_ide: [{ ide, user_initiated_interaction_count }] }
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import { loadUserDailyFiles } from '../loadUserDailyFiles.js'

interface IdeInteractionEntry {
  ide: string
  user_initiated_interaction_count: number
}

interface IdeInteractionDay {
  day: string
  totals_by_ide: IdeInteractionEntry[]
}

export const transformIdeInteractions = (
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
    core.info('No user source files found, skipping IDE transform')
    return
  }

  // Group by day, then aggregate IDE interactions
  const dayIdeMap = new Map<string, Map<string, number>>()

  for (const file of userFiles) {
    const day = file.day as string
    if (!day) continue

    const items = file.totals_by_ide as
      | Array<Record<string, unknown>>
      | undefined
    if (!Array.isArray(items)) continue

    if (!dayIdeMap.has(day)) dayIdeMap.set(day, new Map())
    const ideMap = dayIdeMap.get(day)!

    for (const item of items) {
      const ide = String(item.ide || 'unknown')
      const count = (item.user_initiated_interaction_count as number) || 0
      ideMap.set(ide, (ideMap.get(ide) || 0) + count)
    }
  }

  const transformed: IdeInteractionDay[] = [...dayIdeMap.entries()]
    .map(([day, ideMap]) => ({
      day,
      totals_by_ide: [...ideMap.entries()]
        .map(([ide, user_initiated_interaction_count]) => ({
          ide,
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

  const outputFile = path.join(transformPath, 'ide-interactions.ndjson')
  const ndjson = transformed.map((entry) => JSON.stringify(entry)).join('\n')
  fs.writeFileSync(outputFile, ndjson, 'utf-8')

  core.info(`Wrote ${transformed.length} day(s) to ${outputFile}`)
}
