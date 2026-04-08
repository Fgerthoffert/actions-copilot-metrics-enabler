import { jest } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { generateReports } = await import(
  '../src/utils/report/generateReports.js'
)

/** Helper to write an org source file */
const writeOrgDay = (dir: string, day: string, data: object) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, `${day}.json`),
    JSON.stringify({ day, ...data })
  )
}

/** Helper to write a user source file */
const writeUserDay = (
  dir: string,
  day: string,
  login: string,
  data: object
) => {
  const dayDir = path.join(dir, day)
  if (!fs.existsSync(dayDir)) fs.mkdirSync(dayDir, { recursive: true })
  fs.writeFileSync(
    path.join(dayDir, `${day}-${login}.json`),
    JSON.stringify({ day, user_login: login, ...data })
  )
}

describe('generateReports', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-gen-reports-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Produces report files from source data', async () => {
    const orgDir = path.join(tmpDir, 'source', 'organization')
    const usersDir = path.join(tmpDir, 'source', 'users')
    fs.mkdirSync(orgDir, { recursive: true })
    fs.mkdirSync(usersDir, { recursive: true })

    writeOrgDay(orgDir, '2026-04-01', {
      daily_active_users: 2,
      user_initiated_interaction_count: 300,
      totals_by_ide: [
        { ide: 'vscode', user_initiated_interaction_count: 200 },
        { ide: 'jetbrains', user_initiated_interaction_count: 100 }
      ],
      totals_by_feature: [
        { feature: 'chat', user_initiated_interaction_count: 200 },
        {
          feature: 'code_completions',
          user_initiated_interaction_count: 100
        }
      ],
      totals_by_model_feature: [
        {
          model: 'gpt-4o',
          feature: 'chat',
          user_initiated_interaction_count: 300
        }
      ]
    })

    writeUserDay(usersDir, '2026-04-01', 'alice', {
      totals_by_feature: [
        { feature: 'chat', user_initiated_interaction_count: 120 }
      ],
      totals_by_model_feature: [
        {
          model: 'gpt-4o',
          feature: 'chat',
          user_initiated_interaction_count: 120
        }
      ]
    })

    await generateReports(tmpDir)

    const reportDir = path.join(tmpDir, 'report')
    expect(fs.existsSync(reportDir)).toBe(true)

    // Should have README + individual report files
    const files = fs.readdirSync(reportDir)
    expect(files).toContain('README.md')
    expect(files).toContain('ai-adoption.md')
    expect(files).toContain('ide-adoption.md')
    expect(files).toContain('feature-adoption.md')
    expect(files).toContain('model-adoption.md')
  })

  it('Handles empty source gracefully', async () => {
    const orgDir = path.join(tmpDir, 'source', 'organization')
    fs.mkdirSync(orgDir, { recursive: true })

    await generateReports(tmpDir)

    // No report dir should be created
    const reportDir = path.join(tmpDir, 'report')
    expect(fs.existsSync(reportDir)).toBe(false)
  })
})
