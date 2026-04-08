import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

/**
 * Saves users metrics by splitting downloaded data into per-user JSON files
 * inside a date folder: storePath/YYYY-MM-DD/YYYY-MM-DD-username.json
 */
export const saveUserDailyMetrics = async (
  storePath: string,
  day: string,
  dataItems: Record<string, unknown>[]
): Promise<void> => {
  const dayDir = path.join(storePath, day)
  if (!fs.existsSync(dayDir)) {
    fs.mkdirSync(dayDir, { recursive: true })
  }

  for (const data of dataItems) {
    const userLogin = data.user_login as string
    if (!userLogin) {
      core.warning(`Skipping user record without user_login for ${day}`)
      continue
    }

    const fileName = `${day}-${userLogin}.json`
    const filePath = path.join(dayDir, fileName)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    core.debug(`Saved user metrics for ${userLogin} on ${day}`)
  }

  core.info(`Saved user metrics for ${day} to ${dayDir}`)
}
