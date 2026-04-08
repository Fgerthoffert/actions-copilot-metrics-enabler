import * as core from '@actions/core'

import { getExistingUserDailyDates } from './getExistingUserDailyDates.js'
import { getMissingDays } from './getMissingDays.js'
import { getUsersMetrics } from './github/getUsersMetrics.js'
import { downloadNdjsonContent } from './downloadNdjsonContent.js'
import { saveUserDailyMetrics } from './saveUserDailyMetrics.js'

/**
 * Orchestrates fetching and saving Copilot users metrics for all missing days.
 * Downloads report content and splits into per-user JSON files in date folders.
 */
export const fetchMissingUsersMetrics = async ({
  githubToken,
  org,
  storePath,
  lookbackDays
}: {
  githubToken: string
  org: string
  storePath: string
  lookbackDays: number
}): Promise<void> => {
  const existingDates = await getExistingUserDailyDates(storePath)
  const missingDays = getMissingDays(existingDates, lookbackDays)

  if (missingDays.length === 0) {
    core.info(
      'All users daily metrics folders are up-to-date, nothing to fetch'
    )
    return
  }

  for (const day of missingDays) {
    try {
      const apiResponse = await getUsersMetrics({ githubToken, org, day })
      const downloadLinks = apiResponse.download_links as string[]

      if (!Array.isArray(downloadLinks) || downloadLinks.length === 0) {
        core.warning(`No download links returned for ${day}, skipping`)
        continue
      }

      const reportData = await downloadNdjsonContent(downloadLinks)
      await saveUserDailyMetrics(storePath, day, reportData)
    } catch (error) {
      core.warning(
        `Failed to fetch users metrics for ${day}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
