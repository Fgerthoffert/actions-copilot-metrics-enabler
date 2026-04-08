import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

/**
 * Loads all per-user JSON files from date folders under storePath.
 * Expects structure: storePath/YYYY-MM-DD/YYYY-MM-DD-username.json
 */
export const loadUserDailyFiles = (
  storePath: string
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
  return results
}
