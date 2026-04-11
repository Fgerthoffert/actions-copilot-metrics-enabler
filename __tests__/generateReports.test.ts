import { jest } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { generateReports } =
  await import('../src/utils/report/generateReports.js')

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

  it('Produces report files from user source data', async () => {
    const usersDir = path.join(tmpDir, 'source', 'users')
    fs.mkdirSync(usersDir, { recursive: true })

    writeUserDay(usersDir, '2026-04-01', 'alice', {
      user_initiated_interaction_count: 200,
      totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 200 }],
      totals_by_feature: [
        { feature: 'chat', user_initiated_interaction_count: 120 },
        {
          feature: 'code_completions',
          user_initiated_interaction_count: 80
        }
      ],
      totals_by_model_feature: [
        {
          model: 'gpt-4o',
          feature: 'chat',
          user_initiated_interaction_count: 200
        }
      ]
    })
    writeUserDay(usersDir, '2026-04-01', 'bob', {
      user_initiated_interaction_count: 100,
      totals_by_ide: [
        { ide: 'jetbrains', user_initiated_interaction_count: 100 }
      ],
      totals_by_feature: [
        { feature: 'chat', user_initiated_interaction_count: 100 }
      ],
      totals_by_model_feature: [
        {
          model: 'gpt-4o',
          feature: 'chat',
          user_initiated_interaction_count: 100
        }
      ]
    })

    await generateReports(tmpDir, tmpDir)

    const reportDir = path.join(tmpDir, 'report')
    expect(fs.existsSync(reportDir)).toBe(true)

    // Should have README + individual report files
    const files = fs.readdirSync(reportDir)
    expect(files).toContain('README.md')
    expect(files).toContain('ai-adoption.md')
    expect(files).toContain('ide-adoption.md')
    expect(files).toContain('feature-adoption.md')
    expect(files).toContain('model-adoption.md')

    // README should contain people summary
    const readme = fs.readFileSync(path.join(reportDir, 'README.md'), 'utf-8')
    expect(readme).toContain('## People Included')
    expect(readme).toContain('| alice |')
    expect(readme).toContain('| bob |')
    expect(readme).toContain('**2** user(s)')
    expect(readme).toContain('| User | Days Active | Interactions')
    expect(readme).toContain('% of Total |')
    expect(readme).toContain('**Days Active:**')
    expect(readme).toContain('**Interactions:**')
  })

  it('Includes filter note in README when include_users is set', async () => {
    const usersDir = path.join(tmpDir, 'source', 'users')
    fs.mkdirSync(usersDir, { recursive: true })

    writeUserDay(usersDir, '2026-04-01', 'alice', {
      user_initiated_interaction_count: 200,
      totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 200 }],
      totals_by_feature: [
        { feature: 'chat', user_initiated_interaction_count: 200 }
      ]
    })
    writeUserDay(usersDir, '2026-04-01', 'bob', {
      user_initiated_interaction_count: 100,
      totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 100 }],
      totals_by_feature: [
        { feature: 'chat', user_initiated_interaction_count: 100 }
      ]
    })

    await generateReports(tmpDir, tmpDir, ['alice'], [])

    const readme = fs.readFileSync(
      path.join(tmpDir, 'report', 'README.md'),
      'utf-8'
    )
    expect(readme).toContain('**1** user(s)')
    expect(readme).toContain('| alice |')
    expect(readme).not.toContain('| bob |')
    expect(readme).toContain('Filtered by include list: alice')
  })

  it('Handles empty source gracefully', async () => {
    const usersDir = path.join(tmpDir, 'source', 'users')
    fs.mkdirSync(usersDir, { recursive: true })

    await generateReports(tmpDir, tmpDir)

    // No report dir should be created
    const reportDir = path.join(tmpDir, 'report')
    expect(fs.existsSync(reportDir)).toBe(false)
  })

  it('Writes transforms and reports to separate report_path', async () => {
    const usersDir = path.join(tmpDir, 'source', 'users')
    fs.mkdirSync(usersDir, { recursive: true })

    const reportRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'test-gen-report-path-')
    )

    writeUserDay(usersDir, '2026-04-01', 'alice', {
      user_initiated_interaction_count: 200,
      totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 200 }],
      totals_by_feature: [
        { feature: 'chat', user_initiated_interaction_count: 200 }
      ],
      totals_by_model_feature: [
        {
          model: 'gpt-4o',
          feature: 'chat',
          user_initiated_interaction_count: 200
        }
      ]
    })

    await generateReports(tmpDir, reportRoot)

    // Transforms should be under reportRoot, not tmpDir
    expect(
      fs.existsSync(
        path.join(reportRoot, 'transform', 'organization', 'daily-usage.ndjson')
      )
    ).toBe(true)
    expect(
      fs.existsSync(
        path.join(tmpDir, 'transform', 'organization', 'daily-usage.ndjson')
      )
    ).toBe(false)

    // Reports should be under reportRoot
    const reportDir = path.join(reportRoot, 'report')
    expect(fs.existsSync(reportDir)).toBe(true)
    expect(fs.readdirSync(reportDir)).toContain('README.md')

    // Source data should remain under tmpDir only
    expect(
      fs.existsSync(path.join(tmpDir, 'source', 'users', '2026-04-01'))
    ).toBe(true)

    fs.rmSync(reportRoot, { recursive: true, force: true })
  })
})
