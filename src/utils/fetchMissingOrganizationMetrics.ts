import * as core from '@actions/core'

import { getExistingDailyFiles } from './getExistingDailyFiles.js'
import { getMissingDays } from './getMissingDays.js'
import { getOrganizationMetrics } from './github/getOrganizationMetrics.js'
import { downloadReportContent } from './downloadReportContent.js'
import { saveDailyMetrics } from './saveDailyMetrics.js'

/**
 * Orchestrates fetching and saving Copilot metrics for all missing days.
 * Scans storePath for existing files, identifies gaps in the last 28 days,
 * fetches the download links from the API, downloads the actual report content,
 * and saves each day's data.
 */
export const fetchMissingOrganizationMetrics = async ({
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
  const existingDates = await getExistingDailyFiles(storePath)
  const missingDays = getMissingDays(existingDates, lookbackDays)

  if (missingDays.length === 0) {
    core.info('All daily metrics files are up-to-date, nothing to fetch')
    return
  }

  for (const day of missingDays) {
    try {
      const apiResponse = await getOrganizationMetrics({
        githubToken,
        org,
        day
      })
      const downloadLinks = apiResponse.download_links as string[]

      if (!Array.isArray(downloadLinks) || downloadLinks.length === 0) {
        core.warning(`No download links returned for ${day}, skipping`)
        continue
      }

      const reportData = await downloadReportContent(downloadLinks)
      await saveDailyMetrics(storePath, day, reportData)
    } catch (error) {
      core.warning(
        `Failed to fetch metrics for ${day}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
