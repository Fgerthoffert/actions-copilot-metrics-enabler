import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

/**
 * Saves metrics data as daily JSON files. The first item is saved as YYYY-MM-DD.json,
 * additional items are saved as YYYY-MM-DD.json.1, YYYY-MM-DD.json.2, etc.
 */
export const saveDailyMetrics = async (
  storePath: string,
  day: string,
  dataItems: Record<string, unknown>[]
): Promise<void> => {
  if (!fs.existsSync(storePath)) {
    fs.mkdirSync(storePath, { recursive: true })
  }

  for (const [index, data] of dataItems.entries()) {
    const fileName = index === 0 ? `${day}.json` : `${day}.json.${index}`
    const filePath = path.join(storePath, fileName)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    core.info(`Saved metrics for ${day} to ${filePath}`)
  }
}
