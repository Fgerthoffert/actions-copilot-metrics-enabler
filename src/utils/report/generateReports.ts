/**
 * Orchestrates the report pipeline:
 * 1. Run transforms on users source data to produce intermediate NDJSON files
 * 2. Generate reports from the transformed data
 */

import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

import { loadUserDailyFiles } from '../loadUserDailyFiles.js'
import { transformIdeInteractions } from '../transform/transformIdeInteractions.js'
import { transformFeatureInteractions } from '../transform/transformFeatureInteractions.js'
import { transformFeatureAdoption } from '../transform/transformFeatureAdoption.js'
import { transformModelAdoption } from '../transform/transformModelAdoption.js'
import { transformDailyUsage } from '../transform/transformDailyUsage.js'
import { generateIdeAdoptionReport } from './generateIdeAdoptionReport.js'
import { generateFeatureAdoptionReport } from './generateFeatureAdoptionReport.js'
import { generatePerFeatureAdoptionReport } from './generatePerFeatureAdoptionReport.js'
import { generateModelAdoptionReport } from './generateModelAdoptionReport.js'
import { generatePerModelAdoptionReport } from './generatePerModelAdoptionReport.js'
import { generatePerUserAdoptionReport } from './generatePerUserAdoptionReport.js'
import { generateDailyUsageReport } from './generateDailyUsageReport.js'
import { generateUserPrompts } from './generateUserPrompts.js'
import { writeReportFiles } from './writeReportFiles.js'
import type { ReportFile } from './writeReportFiles.js'

export const generateReports = async (
  storePath: string,
  includeUsers: string[] = [],
  excludeUsers: string[] = []
): Promise<void> => {
  core.info('Running ETL pipeline for reports')

  const usersSourcePath = path.join(storePath, 'source', 'users')
  const transformPath = path.join(storePath, 'transform', 'organization')

  // Transform step
  transformIdeInteractions(
    usersSourcePath,
    transformPath,
    includeUsers,
    excludeUsers
  )
  transformFeatureInteractions(
    usersSourcePath,
    transformPath,
    includeUsers,
    excludeUsers
  )
  transformFeatureAdoption(
    usersSourcePath,
    transformPath,
    includeUsers,
    excludeUsers
  )
  transformModelAdoption(
    usersSourcePath,
    transformPath,
    includeUsers,
    excludeUsers
  )
  transformDailyUsage(
    usersSourcePath,
    transformPath,
    includeUsers,
    excludeUsers
  )

  // Report generation step
  const reportFiles: ReportFile[] = []
  reportFiles.push(...generateDailyUsageReport(transformPath))
  reportFiles.push(...generateIdeAdoptionReport(transformPath))
  reportFiles.push(...generateFeatureAdoptionReport(transformPath))
  reportFiles.push(...generatePerFeatureAdoptionReport(transformPath))
  reportFiles.push(...generateModelAdoptionReport(transformPath))
  reportFiles.push(...generatePerModelAdoptionReport(transformPath))
  reportFiles.push(...generatePerUserAdoptionReport(transformPath))

  // Per-user enablement prompts (reads raw source data)
  const promptFiles = generateUserPrompts(
    usersSourcePath,
    includeUsers,
    excludeUsers
  )
  reportFiles.push(...promptFiles)

  if (reportFiles.length === 0) {
    core.info('No report content generated')
    return
  }

  // Determine included users from the filtered source data
  const userFiles = loadUserDailyFiles(
    usersSourcePath,
    includeUsers,
    excludeUsers
  )
  const includedUsers = [
    ...new Set(
      userFiles.map((f) => f.user_login as string).filter((login) => !!login)
    )
  ].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

  // Compute per-user interactions over the past 20 working days (Mon–Fri)
  const allDays = [...new Set(userFiles.map((f) => f.day as string))].sort()
  const workingDays = allDays.filter((d) => {
    const dow = new Date(d + 'T00:00:00Z').getUTCDay()
    return dow >= 1 && dow <= 5
  })
  const recentWorkingDays = new Set(workingDays.slice(-20))

  const userInteractions = new Map<string, number>()
  const userDayDetails = new Map<
    string,
    { day: string; user_initiated_interaction_count: number }[]
  >()
  for (const f of userFiles) {
    const day = f.day as string
    if (!recentWorkingDays.has(day)) continue
    const login = f.user_login as string
    const count = (f.user_initiated_interaction_count as number) || 0
    userInteractions.set(login, (userInteractions.get(login) || 0) + count)
    if (!userDayDetails.has(login)) userDayDetails.set(login, [])
    userDayDetails
      .get(login)!
      .push({ day, user_initiated_interaction_count: count })
  }

  // Sort each user's day details chronologically
  for (const details of userDayDetails.values()) {
    details.sort((a, b) => a.day.localeCompare(b.day))
  }

  let totalInteractions = 0
  for (const c of userInteractions.values()) totalInteractions += c

  const numDays = recentWorkingDays.size || 1

  // Build summary entries and write transform file
  const summaryEntries = includedUsers.map((user) => {
    const days = userDayDetails.get(user) || []
    const interactions = userInteractions.get(user) || 0
    const avg_per_day = parseFloat((interactions / numDays).toFixed(1))
    const pct_of_total = parseFloat(
      totalInteractions > 0
        ? ((interactions / totalInteractions) * 100).toFixed(1)
        : '0.0'
    )
    return {
      user,
      days_active: days,
      metrics: {
        days_active_count: days.length,
        total_interactions: interactions,
        avg_interactions_per_day: avg_per_day,
        pct_of_total_interactions: pct_of_total
      }
    }
  })

  const summaryFile = path.join(transformPath, 'people-summary.ndjson')
  const summaryNdjson = summaryEntries
    .map((entry) => JSON.stringify(entry))
    .join('\n')
  fs.writeFileSync(summaryFile, summaryNdjson, 'utf-8')
  core.info(`Wrote ${summaryEntries.length} user(s) to ${summaryFile}`)

  const generatedAt = new Date().toISOString()
  let readme = `# Copilot Metrics Reports\n\n`
  readme += `**Generated at:** ${generatedAt}\n\n`
  readme += `Reference: [Copilot Usage Metrics](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics)\n\n`

  readme += `## People Included\n\n`
  readme += `These reports cover **${includedUsers.length}** user(s) over the last **${recentWorkingDays.size}** working day(s):\n\n`
  readme += `| User | Days Active | Interactions (${recentWorkingDays.size}d) | Avg / Day | % of Total |\n`
  readme += `| --- | ---: | ---: | ---: | ---: |\n`
  for (const entry of summaryEntries) {
    const m = entry.metrics
    readme += `| ${entry.user} | ${m.days_active_count} | ${m.total_interactions} | ${m.avg_interactions_per_day.toFixed(1)} | ${m.pct_of_total_interactions.toFixed(1)}% |\n`
  }
  const totalAvg = (totalInteractions / numDays).toFixed(1)
  readme += `| **Total** | | **${totalInteractions}** | **${totalAvg}** | **100.0%** |\n`
  if (includeUsers.length > 0) {
    readme += `\n*Filtered by include list: ${includeUsers.join(', ')}*\n`
  } else if (excludeUsers.length > 0) {
    readme += `\n*Filtered by exclude list: ${excludeUsers.join(', ')}*\n`
  }

  readme += `\n**Days Active:** Days with any AI activity from the user (prompting, code completion, etc.).\n\n`
  readme += `**Interactions:** Number of explicit prompts sent to Copilot (\`user_initiated_interaction_count\`). `
  readme += `Only counts messages or prompts actively sent to the model. `
  readme += `Does not include opening the chat panel, switching modes (e.g. ask, edit, plan, or agent), `
  readme += `using keyboard shortcuts to open the inline UI, or making configuration changes.\n`

  readme += `\n## Available Reports\n\n`

  const isPerBreakdown = (f: string) =>
    f.startsWith('feature-adoption-') || f.startsWith('model-adoption-')
  const isPrompt = (f: string) => f.startsWith('prompts/')

  const mainFiles = reportFiles.filter(
    (f) => !isPerBreakdown(f.filename) && !isPrompt(f.filename)
  )
  for (const file of mainFiles) {
    const title = file.content.split('\n')[0].replace(/^#+\s*/, '')
    readme += `- [${title}](${file.filename})\n`
  }

  const perFeatureFiles = reportFiles.filter((f) =>
    f.filename.startsWith('feature-adoption-')
  )
  if (perFeatureFiles.length > 0) {
    readme += `\n<details>\n<summary>Per Feature Breakdown (${perFeatureFiles.length} reports)</summary>\n\n`
    for (const file of perFeatureFiles) {
      const title = file.content.split('\n')[0].replace(/^#+\s*/, '')
      readme += `- [${title}](${file.filename})\n`
    }
    readme += `\n</details>\n`
  }

  const perModelFiles = reportFiles.filter((f) =>
    f.filename.startsWith('model-adoption-')
  )
  if (perModelFiles.length > 0) {
    readme += `\n<details>\n<summary>Per Model Breakdown (${perModelFiles.length} reports)</summary>\n\n`
    for (const file of perModelFiles) {
      const title = file.content.split('\n')[0].replace(/^#+\s*/, '')
      readme += `- [${title}](${file.filename})\n`
    }
    readme += `\n</details>\n`
  }

  const userPromptFiles = reportFiles.filter((f) => isPrompt(f.filename))
  if (userPromptFiles.length > 0) {
    readme += `\n## Enablement Prompts\n\n`
    readme += `Per-user AI prompts for personalized enablement coaching.\n`
    readme += `Feed these to an AI assistant to generate tailored messages.\n\n`
    for (const file of userPromptFiles) {
      const login = file.filename.replace('prompts/', '').replace('.md', '')
      readme += `- [${login}](${file.filename})\n`
    }
  }

  reportFiles.unshift({ filename: 'README.md', content: readme })

  const reportsPath = path.join(storePath, 'report')
  await writeReportFiles(reportsPath, reportFiles)
}
