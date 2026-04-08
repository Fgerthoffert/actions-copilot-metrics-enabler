/**
 * Transform: reads organization source daily JSON files and cross-references
 * with users source data to produce an NDJSON file with daily usage data,
 * one line per day (most recent first).
 * Each line: { day, daily_active_users, user_initiated_interaction_count,
 *              active_users, inactive_users }
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import { loadDailyFiles } from '../loadDailyFiles.js'
import { loadUserDailyFiles } from '../loadUserDailyFiles.js'

interface DailyUsageEntry {
  day: string
  daily_active_users: number
  user_initiated_interaction_count: number
  active_users: string[]
  inactive_users: string[]
}

export const transformDailyUsage = (
  sourcePath: string,
  transformPath: string,
  usersSourcePath: string
): void => {
  const dailyFiles = loadDailyFiles(sourcePath)

  if (dailyFiles.length === 0) {
    core.info('No organization source files found, skipping daily usage transform')
    return
  }

  // Build day → set of active user logins from users source
  const userFiles = loadUserDailyFiles(usersSourcePath)
  const dayActiveUsers = new Map<string, Set<string>>()
  const allUsers = new Set<string>()

  for (const file of userFiles) {
    const day = file.day as string
    const login = file.user_login as string
    if (!day || !login) continue

    allUsers.add(login)
    if (!dayActiveUsers.has(day)) dayActiveUsers.set(day, new Set())
    dayActiveUsers.get(day)!.add(login)
  }

  const allUsersSorted = [...allUsers].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  )

  const transformed: DailyUsageEntry[] = dailyFiles
    .filter((file) => file.day)
    .map((file) => {
      const day = file.day as string
      const activeSet = dayActiveUsers.get(day) || new Set()
      const activeUsers = [...activeSet].sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      )
      const inactiveUsers = allUsersSorted.filter((u) => !activeSet.has(u))

      return {
        day,
        daily_active_users: (file.daily_active_users as number) || 0,
        user_initiated_interaction_count:
          (file.user_initiated_interaction_count as number) || 0,
        active_users: activeUsers,
        inactive_users: inactiveUsers
      }
    })
    .sort((a, b) => b.day.localeCompare(a.day))

  if (!fs.existsSync(transformPath)) {
    fs.mkdirSync(transformPath, { recursive: true })
  }

  const outputFile = path.join(transformPath, 'daily-usage.ndjson')
  const ndjson = transformed.map((entry) => JSON.stringify(entry)).join('\n')
  fs.writeFileSync(outputFile, ndjson, 'utf-8')

  core.info(`Wrote ${transformed.length} day(s) to ${outputFile}`)
}
