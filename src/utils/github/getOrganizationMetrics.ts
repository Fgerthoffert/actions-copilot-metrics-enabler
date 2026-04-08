import * as core from '@actions/core'
import { Octokit } from '@octokit/core'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods'

export const getOrganizationMetrics = async ({
  githubToken,
  org,
  day
}: {
  githubToken: string
  org: string
  day: string
}): Promise<Record<string, unknown>> => {
  const MyOctokit = Octokit.plugin(paginateRest, restEndpointMethods)
  const octokit = new MyOctokit({ auth: githubToken })

  core.info(`Fetching Copilot metrics for org "${org}" on ${day}`)

  const metrics = await octokit.request(
    'GET /orgs/{org}/copilot/metrics/reports/organization-1-day',
    {
      org,
      day,
      headers: {
        'X-GitHub-Api-Version': '2026-03-10'
      }
    }
  )

  core.info(`Successfully fetched metrics for ${day}`)
  core.debug(JSON.stringify(metrics.data, null, 2))

  return metrics.data as Record<string, unknown>
}
