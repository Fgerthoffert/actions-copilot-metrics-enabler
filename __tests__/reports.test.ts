import { jest } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { generateIdeAdoptionReport } = await import(
  '../src/utils/report/generateIdeAdoptionReport.js'
)
const { generateFeatureAdoptionReport } = await import(
  '../src/utils/report/generateFeatureAdoptionReport.js'
)
const { generatePerFeatureAdoptionReport } = await import(
  '../src/utils/report/generatePerFeatureAdoptionReport.js'
)
const { generateModelAdoptionReport } = await import(
  '../src/utils/report/generateModelAdoptionReport.js'
)
const { generatePerModelAdoptionReport } = await import(
  '../src/utils/report/generatePerModelAdoptionReport.js'
)
const { generateDailyUsageReport } = await import(
  '../src/utils/report/generateDailyUsageReport.js'
)
const { writeReportFiles } = await import(
  '../src/utils/report/writeReportFiles.js'
)

/** Write an NDJSON file from an array of objects */
const writeNdjson = (dir: string, filename: string, records: object[]) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const ndjson = records.map((r) => JSON.stringify(r)).join('\n')
  fs.writeFileSync(path.join(dir, filename), ndjson, 'utf-8')
}

describe('generateIdeAdoptionReport', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-ide-report-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Returns empty array when no data', () => {
    const result = generateIdeAdoptionReport(tmpDir)
    expect(result).toEqual([])
  })

  it('Generates markdown with monthly and daily tables', () => {
    writeNdjson(tmpDir, 'ide-interactions.ndjson', [
      {
        day: '2026-04-02',
        totals_by_ide: [
          { ide: 'vscode', user_initiated_interaction_count: 120 },
          { ide: 'jetbrains', user_initiated_interaction_count: 30 }
        ]
      },
      {
        day: '2026-04-01',
        totals_by_ide: [
          { ide: 'vscode', user_initiated_interaction_count: 100 },
          { ide: 'jetbrains', user_initiated_interaction_count: 50 }
        ]
      }
    ])

    const result = generateIdeAdoptionReport(tmpDir)
    expect(result.length).toBe(1)
    expect(result[0].filename).toBe('ide-adoption.md')

    const md = result[0].content
    expect(md).toContain('# IDE Adoption')
    expect(md).toContain('## Monthly')
    expect(md).toContain('## Daily')
    expect(md).toContain('vscode')
    expect(md).toContain('jetbrains')
    // Check percentage format
    expect(md).toMatch(/\d+ \(\d+%\)/)
  })
})

describe('generateFeatureAdoptionReport', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-feat-report-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Returns empty array when no data', () => {
    const result = generateFeatureAdoptionReport(tmpDir)
    expect(result).toEqual([])
  })

  it('Generates markdown with feature columns', () => {
    writeNdjson(tmpDir, 'feature-interactions.ndjson', [
      {
        day: '2026-04-01',
        totals_by_feature: [
          { feature: 'chat', user_initiated_interaction_count: 200 },
          {
            feature: 'code_completions',
            user_initiated_interaction_count: 100
          }
        ]
      }
    ])

    const result = generateFeatureAdoptionReport(tmpDir)
    expect(result.length).toBe(1)
    expect(result[0].content).toContain('chat')
    expect(result[0].content).toContain('code_completions')
  })
})

describe('generatePerFeatureAdoptionReport', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-per-feat-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Returns empty array when no data', () => {
    const result = generatePerFeatureAdoptionReport(tmpDir)
    expect(result).toEqual([])
  })

  it('Generates one file per feature with user breakdowns', () => {
    writeNdjson(tmpDir, 'feature-adoption.ndjson', [
      {
        day: '2026-04-01',
        total_interactions: 300,
        features: [
          {
            feature: 'chat',
            interactions: 200,
            users: [
              { login: 'alice', interactions: 120 },
              { login: 'bob', interactions: 80 }
            ]
          },
          {
            feature: 'code_completions',
            interactions: 100,
            users: [{ login: 'alice', interactions: 100 }]
          }
        ]
      }
    ])

    const result = generatePerFeatureAdoptionReport(tmpDir)
    expect(result.length).toBe(2)

    const chatReport = result.find((r) =>
      r.filename.includes('chat')
    )
    expect(chatReport).toBeDefined()
    expect(chatReport!.content).toContain('alice')
    expect(chatReport!.content).toContain('bob')
    expect(chatReport!.content).toContain('## Monthly')
    expect(chatReport!.content).toContain('## Daily')
  })
})

describe('generateModelAdoptionReport', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-model-report-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Returns empty array when no data', () => {
    const result = generateModelAdoptionReport(tmpDir)
    expect(result).toEqual([])
  })

  it('Generates markdown with model columns', () => {
    writeNdjson(tmpDir, 'model-adoption.ndjson', [
      {
        day: '2026-04-01',
        total_interactions: 500,
        models: [
          { model: 'gpt-4o', interactions: 400 },
          { model: 'claude-sonnet', interactions: 100 }
        ]
      }
    ])

    const result = generateModelAdoptionReport(tmpDir)
    expect(result.length).toBe(1)
    expect(result[0].content).toContain('gpt-4o')
    expect(result[0].content).toContain('claude-sonnet')
  })

  it('Collapses small models into Others in monthly table', () => {
    writeNdjson(tmpDir, 'model-adoption.ndjson', [
      {
        day: '2026-04-01',
        total_interactions: 1000,
        models: [
          { model: 'gpt-4o', interactions: 900 },
          { model: 'tiny-model', interactions: 10 }
        ]
      }
    ])

    const result = generateModelAdoptionReport(tmpDir)
    const md = result[0].content
    // Monthly section should have Others
    const monthlySection = md.split('## Daily')[0]
    expect(monthlySection).toContain('Others')
    expect(md).toContain('less than 5%')
  })

  it('Does not collapse in daily table', () => {
    writeNdjson(tmpDir, 'model-adoption.ndjson', [
      {
        day: '2026-04-01',
        total_interactions: 1000,
        models: [
          { model: 'gpt-4o', interactions: 900 },
          { model: 'tiny-model', interactions: 10 }
        ]
      }
    ])

    const result = generateModelAdoptionReport(tmpDir)
    const md = result[0].content
    // Daily section should show tiny-model directly
    const dailySection = md.split('## Daily')[1]
    expect(dailySection).toContain('tiny-model')
    // Daily section should NOT have Others column
    const dailyHeader = dailySection.split('\n').find((l) => l.startsWith('|'))
    expect(dailyHeader).not.toContain('Others')
  })
})

describe('generatePerModelAdoptionReport', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-per-model-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Returns empty array when no data', () => {
    const result = generatePerModelAdoptionReport(tmpDir)
    expect(result).toEqual([])
  })

  it('Generates one file per model with user breakdowns', () => {
    writeNdjson(tmpDir, 'model-adoption.ndjson', [
      {
        day: '2026-04-01',
        total_interactions: 500,
        models: [
          {
            model: 'gpt-4o',
            interactions: 300,
            users: [
              { login: 'alice', interactions: 200 },
              { login: 'bob', interactions: 100 }
            ]
          },
          {
            model: 'claude-sonnet',
            interactions: 200,
            users: [{ login: 'alice', interactions: 200 }]
          }
        ]
      }
    ])

    const result = generatePerModelAdoptionReport(tmpDir)
    expect(result.length).toBe(2)

    const gptReport = result.find((r) => r.filename.includes('gpt-4o'))
    expect(gptReport).toBeDefined()
    expect(gptReport!.content).toContain('alice')
    expect(gptReport!.content).toContain('bob')
    expect(gptReport!.content).toContain('60%')
  })
})

describe('generateDailyUsageReport', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-daily-report-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Returns empty array when no data', () => {
    const result = generateDailyUsageReport(tmpDir)
    expect(result).toEqual([])
  })

  it('Generates AI adoption report with monthly and daily tables', () => {
    writeNdjson(tmpDir, 'daily-usage.ndjson', [
      {
        day: '2026-04-02',
        daily_active_users: 3,
        user_initiated_interaction_count: 200,
        active_users: ['alice', 'bob', 'carol'],
        inactive_users: ['dave']
      },
      {
        day: '2026-04-01',
        daily_active_users: 2,
        user_initiated_interaction_count: 150,
        active_users: ['alice', 'bob'],
        inactive_users: ['carol', 'dave']
      }
    ])

    const result = generateDailyUsageReport(tmpDir)
    expect(result.length).toBe(1)
    expect(result[0].filename).toBe('ai-adoption.md')

    const md = result[0].content
    expect(md).toContain('# AI Adoption')
    expect(md).toContain('## Monthly')
    expect(md).toContain('## Daily')
    expect(md).toContain('alice')
    expect(md).toContain('dave')
  })
})

describe('writeReportFiles', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-write-report-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Writes files to the specified directory', async () => {
    const reportsDir = path.join(tmpDir, 'reports')
    await writeReportFiles(reportsDir, [
      { filename: 'README.md', content: '# Index' },
      { filename: 'report.md', content: '# Report' }
    ])

    expect(fs.existsSync(path.join(reportsDir, 'README.md'))).toBe(true)
    expect(fs.existsSync(path.join(reportsDir, 'report.md'))).toBe(true)
    expect(
      fs.readFileSync(path.join(reportsDir, 'report.md'), 'utf-8')
    ).toBe('# Report')
  })

  it('Creates directory if it does not exist', async () => {
    const nested = path.join(tmpDir, 'a', 'b', 'c')
    await writeReportFiles(nested, [
      { filename: 'test.md', content: 'hello' }
    ])
    expect(fs.existsSync(path.join(nested, 'test.md'))).toBe(true)
  })
})
