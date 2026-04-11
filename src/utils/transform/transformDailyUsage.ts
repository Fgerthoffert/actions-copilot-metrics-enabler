/**
 * Transform: reads per-user source data and aggregates daily usage data,
 * one line per day (most recent first).
 * Each line: { day, daily_active_users, user_initiated_interaction_count,
 *              active_users, active_users_with_interactions,
 *              active_users_without_interactions, inactive_users }
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import { loadUserDailyFiles } from '../loadUserDailyFiles.js'

interface DailyUsageEntry {
  day: string
  daily_active_users: number
  user_initiated_interaction_count: number
  active_users: string[]
  active_users_with_interactions: string[]
  active_users_without_interactions: string[]
  inactive_users: string[]
}

export const transformDailyUsage = (
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
    core.info('No user source files found, skipping daily usage transform')
    return
  }

  // Build day → set of active user logins and interaction counts
  const dayActiveUsers = new Map<string, Set<string>>()
  const dayInteractions = new Map<string, number>()
  const dayUserInteractions = new Map<string, Map<string, number>>()
  const allUsers = new Set<string>()

  for (const file of userFiles) {
    const day = file.day as string
    const login = file.user_login as string
    if (!day || !login) continue

    allUsers.add(login)
    if (!dayActiveUsers.has(day)) dayActiveUsers.set(day, new Set())
    dayActiveUsers.get(day)!.add(login)

    const interactions = (file.user_initiated_interaction_count as number) || 0
    dayInteractions.set(day, (dayInteractions.get(day) || 0) + interactions)

    if (!dayUserInteractions.has(day)) dayUserInteractions.set(day, new Map())
    dayUserInteractions.get(day)!.set(login, interactions)
  }

  const allUsersSorted = [...allUsers].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  )

  const transformed: DailyUsageEntry[] = [...dayActiveUsers.entries()]
    .map(([day, activeSet]) => {
      const userInteractions = dayUserInteractions.get(day) || new Map()
      const activeUsers = [...activeSet].sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      )
      const activeWithInteractions = activeUsers.filter(
        (u) => (userInteractions.get(u) || 0) > 0
      )
      const activeWithoutInteractions = activeUsers.filter(
        (u) => (userInteractions.get(u) || 0) === 0
      )
      const inactiveUsers = allUsersSorted.filter((u) => !activeSet.has(u))

      return {
        day,
        daily_active_users: activeSet.size,
        user_initiated_interaction_count: dayInteractions.get(day) || 0,
        active_users: activeUsers,
        active_users_with_interactions: activeWithInteractions,
        active_users_without_interactions: activeWithoutInteractions,
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
