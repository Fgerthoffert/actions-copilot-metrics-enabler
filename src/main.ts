import * as path from 'path'

import * as core from '@actions/core'

import { getConnectedUser } from './utils/github/getConnectedUser.js'
import { fetchMissingUsersMetrics } from './utils/fetchMissingUsersMetrics.js'
import { getCacheDirectory } from './utils/getCacheDirectory.js'
import { generateReports } from './utils/report/generateReports.js'

/**
 * Parses a comma-separated input string into a trimmed, non-empty array of strings.
 */
const parseListInput = (input: string): string[] =>
  input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const inputGithubToken = core.getInput('github_token')
    const inputPath = core.getInput('path')
    const inputReportPath = core.getInput('report_path')
    const inputOrg = core.getInput('github_org')
    const inputSummaryReport = core.getInput('summary_report')
    const lookbackDays = parseInt(core.getInput('lookback_days') || '100', 10)
    const includeUsers = parseListInput(core.getInput('include_users'))
    const excludeUsers = parseListInput(core.getInput('exclude_users'))

    // Simple API call to ensure the provided token is valid and display the associated username
    await getConnectedUser({ githubToken: inputGithubToken })

    let storePath: string = inputPath
    if (!storePath) {
      core.info(
        `No path provided, will be storing the results in a temporary cache directory`
      )
      storePath = await getCacheDirectory(`copilot-metrics-cache-${inputOrg}`)
    }

    core.info(`Metrics will be stored at: ${storePath}`)

    // Fetch all user-level metrics
    const usersPath = path.join(storePath, 'source', 'users')
    core.info('Collecting data for user metrics')
    await fetchMissingUsersMetrics({
      githubToken: inputGithubToken,
      org: inputOrg,
      storePath: usersPath,
      lookbackDays
    })

    if (inputSummaryReport === 'true') {
      const reportPath = inputReportPath || storePath
      await generateReports(storePath, reportPath, includeUsers, excludeUsers)
    }

    core.setOutput('path', storePath)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
