import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

export interface ReportFile {
  filename: string
  content: string
}

/**
 * Writes an array of report markdown files to the reports directory.
 * Also writes to GitHub Actions job summary if available.
 */
export const writeReportFiles = async (
  reportsPath: string,
  files: ReportFile[]
): Promise<void> => {
  if (!fs.existsSync(reportsPath)) {
    fs.mkdirSync(reportsPath, { recursive: true })
  }

  for (const file of files) {
    const filePath = path.join(reportsPath, file.filename)
    const fileDir = path.dirname(filePath)
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true })
    }
    fs.writeFileSync(filePath, file.content, 'utf-8')
    core.info(`Report written to ${filePath}`)
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const readmeFile = files.find((f) => f.filename === 'README.md')
    if (readmeFile) {
      await core.summary.addRaw(readmeFile.content).write()
      core.info('Report index written to GitHub Actions job summary')
    }
  }
}
