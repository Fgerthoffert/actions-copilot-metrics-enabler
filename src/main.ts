import * as path from 'path'

import * as core from '@actions/core'

import { getConnectedUser } from './utils/github/getConnectedUser.js'
import { fetchMissingOrganizationMetrics } from './utils/fetchMissingOrganizationMetrics.js'
import { fetchMissingUsersMetrics } from './utils/fetchMissingUsersMetrics.js'
import { getCacheDirectory } from './utils/getCacheDirectory.js'
import { generateReports } from './utils/report/generateReports.js'

const METRICS_TYPES = ['organization', 'users'] as const
type MetricType = (typeof METRICS_TYPES)[number]

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const inputGithubToken = core.getInput('github_token')
    const inputPath = core.getInput('path')
    const inputOrg = core.getInput('github_org')
    const inputSummaryReport = core.getInput('summary_report')
    const inputMetrics = core.getInput('reports') || 'all'
    const lookbackDays = parseInt(core.getInput('lookback_days') || '100', 10)

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

    const activeMetrics: MetricType[] =
      inputMetrics === 'all'
        ? [...METRICS_TYPES]
        : (inputMetrics
            .split(',')
            .map((r) => r.trim())
            .filter((r): r is MetricType =>
              METRICS_TYPES.includes(r as MetricType)
            ) as MetricType[])

    if (activeMetrics.length === 0) {
      core.warning(
        `No valid metrics types specified in "${inputMetrics}". Valid values: ${METRICS_TYPES.join(', ')}, all`
      )
    }

    // Collect all metrics for up to 28 days prior
    for (const metric of activeMetrics) {
      const metricsPath = path.join(storePath, 'source', metric)
      core.info(`Collecting data for metrics type: ${metric}`)

      if (metric === 'organization') {
        await fetchMissingOrganizationMetrics({
          githubToken: inputGithubToken,
          org: inputOrg,
          storePath: metricsPath,
          lookbackDays
        })
      } else if (metric === 'users') {
        await fetchMissingUsersMetrics({
          githubToken: inputGithubToken,
          org: inputOrg,
          storePath: metricsPath,
          lookbackDays
        })
      }
    }

    if (inputSummaryReport === 'true') {
      await generateReports(storePath)
    }

    core.setOutput('path', storePath)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
