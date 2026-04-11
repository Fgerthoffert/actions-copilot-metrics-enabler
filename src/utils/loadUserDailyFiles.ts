import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

/**
 * Loads all per-user JSON files from date folders under storePath.
 * Expects structure: storePath/YYYY-MM-DD/YYYY-MM-DD-username.json
 *
 * Optionally filters by include/exclude user login lists.
 * When includeUsers is non-empty, only those users are kept.
 * When excludeUsers is non-empty, those users are removed.
 */
export const loadUserDailyFiles = (
  storePath: string,
  includeUsers: string[] = [],
  excludeUsers: string[] = []
): Record<string, unknown>[] => {
  const dateDirPattern = /^\d{4}-\d{2}-\d{2}$/
  const jsonPattern = /\.json$/

  if (!fs.existsSync(storePath)) {
    core.info(`Store path does not exist: ${storePath}`)
    return []
  }

  const results: Record<string, unknown>[] = []
  const dateDirs = fs
    .readdirSync(storePath, { withFileTypes: true })
    .filter((e) => e.isDirectory() && dateDirPattern.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name))

  for (const dir of dateDirs) {
    const dirPath = path.join(storePath, dir.name)
    const files = fs.readdirSync(dirPath).filter((f) => jsonPattern.test(f))

    for (const f of files) {
      const content = fs.readFileSync(path.join(dirPath, f), 'utf-8')
      results.push(JSON.parse(content) as Record<string, unknown>)
    }
  }

  core.info(`Loaded ${results.length} user daily file(s) for report generation`)

  let filtered = results
  if (includeUsers.length > 0) {
    filtered = filtered.filter((f) =>
      includeUsers.includes(f.user_login as string)
    )
    core.info(
      `Include filter applied: ${filtered.length} file(s) kept for ${includeUsers.length} user(s)`
    )
  } else if (excludeUsers.length > 0) {
    filtered = filtered.filter(
      (f) => !excludeUsers.includes(f.user_login as string)
    )
    core.info(
      `Exclude filter applied: ${filtered.length} file(s) kept after removing ${excludeUsers.length} user(s)`
    )
  }

  return filtered
}
