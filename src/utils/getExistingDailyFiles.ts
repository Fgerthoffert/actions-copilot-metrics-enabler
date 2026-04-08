import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

/**
 * Scans a directory for existing daily JSON files matching the YYYY-MM-DD.json pattern
 * and returns a Set of the date strings found.
 */
export const getExistingDailyFiles = async (
  storePath: string
): Promise<Set<string>> => {
  const datePattern = /^\d{4}-\d{2}-\d{2}\.json$/

  if (!fs.existsSync(storePath)) {
    core.info(`Store path does not exist yet: ${storePath}`)
    return new Set()
  }

  const files = fs.readdirSync(storePath)
  const existingDates = new Set(
    files
      .filter((f) => datePattern.test(f))
      .map((f) => path.basename(f, '.json'))
  )

  core.info(
    `Found ${existingDates.size} existing daily file(s) in ${storePath}`
  )

  return existingDates
}
