/**
 * Orchestrates the full summary report generation for a given metrics type.
 * Delegates to the appropriate report generator and writes the results
 * as multiple markdown files in a reports/ directory.
 */

import * as path from 'path'

import * as core from '@actions/core'

import { generateOrganizationReport } from './generateOrganizationReport.js'
import { generateUsersReport } from './generateUsersReport.js'
import { writeReportFiles } from './writeReportFiles.js'
import type { ReportFile } from './writeReportFiles.js'

export const generateSummaryReport = async (
  storePath: string,
  metricsPath: string,
  reportName: string = 'copilot-metrics'
): Promise<void> => {
  core.info(`Generating summary report for ${reportName}`)

  let reportFiles: ReportFile[] = []

  if (reportName === 'organization') {
    reportFiles = generateOrganizationReport(storePath)
  } else if (reportName === 'users') {
    reportFiles = generateUsersReport(storePath)
  }

  if (reportFiles.length === 0) {
    core.info(`No report content generated for ${reportName}`)
    return
  }

  const generatedAt = new Date().toISOString()
  let readme = `# Copilot Metrics Report — ${reportName}\n\n`
  readme += `**Generated at:** ${generatedAt}\n\n`
  readme += `## Available Reports\n\n`

  for (const file of reportFiles) {
    const title = file.content.split('\n')[0].replace(/^#+\s*/, '')
    readme += `- [${title}](${file.filename})\n`
  }

  reportFiles.unshift({ filename: 'README.md', content: readme })

  const reportsPath = path.join(metricsPath, 'reports', reportName)
  await writeReportFiles(reportsPath, reportFiles)
}
