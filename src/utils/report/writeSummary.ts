import * as fs from 'fs'
import * as path from 'path'

import * as core from '@actions/core'

/**
 * Writes the summary markdown to the GitHub Actions job summary when available,
 * or falls back to writing a static markdown file in the store path
 * (useful for local runs with `npx local-action`).
 */
export const writeSummary = async (
  markdown: string,
  storePath: string
): Promise<void> => {
  if (process.env.GITHUB_STEP_SUMMARY) {
    await core.summary.addRaw(markdown).write()
    core.info('Summary report written to GitHub Actions job summary')
  } else {
    const filePath = path.join(storePath, 'summary-report.md')
    fs.writeFileSync(filePath, markdown, 'utf-8')
    core.info(
      `GITHUB_STEP_SUMMARY not available, summary report written to ${filePath}`
    )
  }
}
