import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

/**
 * Loads and parses all daily JSON files (including multi-part files like .json.1)
 * from the store path, returning them sorted chronologically.
 */
export const loadDailyFiles = (
  storePath: string
): Record<string, unknown>[] => {
  const filePattern = /^\d{4}-\d{2}-\d{2}\.json(\.\d+)?$/

  if (!fs.existsSync(storePath)) {
    core.info(`Store path does not exist: ${storePath}`)
    return []
  }

  const files = fs.readdirSync(storePath).filter((f) => filePattern.test(f))
  files.sort()

  const results = files.map((f) => {
    const content = fs.readFileSync(path.join(storePath, f), 'utf-8')
    return JSON.parse(content) as Record<string, unknown>
  })

  core.info(`Loaded ${results.length} daily file(s) for report generation`)
  return results
}
