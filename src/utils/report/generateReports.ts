/**
 * Orchestrates the report pipeline:
 * 1. Run transforms on source data to produce intermediate NDJSON files
 * 2. Generate reports from the transformed data
 */

import * as path from 'path'

import * as core from '@actions/core'

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
import { generateDailyUsageReport } from './generateDailyUsageReport.js'
import { writeReportFiles } from './writeReportFiles.js'
import type { ReportFile } from './writeReportFiles.js'

export const generateReports = async (storePath: string): Promise<void> => {
  core.info('Running ETL pipeline for reports')

  const orgSourcePath = path.join(storePath, 'source', 'organization')
  const orgTransformPath = path.join(storePath, 'transform', 'organization')
  const usersSourcePath = path.join(storePath, 'source', 'users')

  // Transform step
  transformIdeInteractions(orgSourcePath, orgTransformPath)
  transformFeatureInteractions(orgSourcePath, orgTransformPath)
  transformFeatureAdoption(orgSourcePath, orgTransformPath, usersSourcePath)
  transformModelAdoption(orgSourcePath, orgTransformPath, usersSourcePath)
  transformDailyUsage(orgSourcePath, orgTransformPath, usersSourcePath)

  // Report generation step
  const reportFiles: ReportFile[] = []
  reportFiles.push(...generateDailyUsageReport(orgTransformPath))
  reportFiles.push(...generateIdeAdoptionReport(orgTransformPath))
  reportFiles.push(...generateFeatureAdoptionReport(orgTransformPath))
  reportFiles.push(...generatePerFeatureAdoptionReport(orgTransformPath))
  reportFiles.push(...generateModelAdoptionReport(orgTransformPath))
  reportFiles.push(...generatePerModelAdoptionReport(orgTransformPath))

  if (reportFiles.length === 0) {
    core.info('No report content generated')
    return
  }

  const generatedAt = new Date().toISOString()
  let readme = `# Copilot Metrics Reports\n\n`
  readme += `**Generated at:** ${generatedAt}\n\n`
  readme += `Reference: [Copilot Usage Metrics](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics)\n\n`
  readme += `## Available Reports\n\n`

  for (const file of reportFiles) {
    const title = file.content.split('\n')[0].replace(/^#+\s*/, '')
    readme += `- [${title}](${file.filename})\n`
  }

  reportFiles.unshift({ filename: 'README.md', content: readme })

  const reportsPath = path.join(storePath, 'report')
  await writeReportFiles(reportsPath, reportFiles)
}
