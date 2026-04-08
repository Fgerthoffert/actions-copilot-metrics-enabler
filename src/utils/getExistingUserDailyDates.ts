import * as fs from 'fs'

import * as core from '@actions/core'

/**
 * Scans storePath for existing YYYY-MM-DD date folders (used by users metrics)
 * and returns a Set of date strings that already have data.
 */
export const getExistingUserDailyDates = async (
  storePath: string
): Promise<Set<string>> => {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/

  if (!fs.existsSync(storePath)) {
    core.info(`Store path does not exist yet: ${storePath}`)
    return new Set()
  }

  const entries = fs.readdirSync(storePath, { withFileTypes: true })
  const existingDates = new Set(
    entries
      .filter((e) => e.isDirectory() && datePattern.test(e.name))
      .map((e) => e.name)
  )

  core.info(
    `Found ${existingDates.size} existing user daily folder(s) in ${storePath}`
  )

  return existingDates
}
