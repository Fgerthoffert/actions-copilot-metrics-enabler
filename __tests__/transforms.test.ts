import { jest } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { transformIdeInteractions } =
  await import('../src/utils/transform/transformIdeInteractions.js')
const { transformFeatureInteractions } =
  await import('../src/utils/transform/transformFeatureInteractions.js')
const { transformDailyUsage } =
  await import('../src/utils/transform/transformDailyUsage.js')
const { transformFeatureAdoption } =
  await import('../src/utils/transform/transformFeatureAdoption.js')
const { transformModelAdoption } =
  await import('../src/utils/transform/transformModelAdoption.js')

/** Helper to create org source data */
const writeOrgDay = (dir: string, day: string, data: object) => {
  fs.writeFileSync(
    path.join(dir, `${day}.json`),
    JSON.stringify({ day, ...data })
  )
}

/** Helper to create user source data */
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

describe('transformIdeInteractions', () => {
  let srcDir: string
  let outDir: string

  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-transform-'))
    srcDir = path.join(tmp, 'source')
    outDir = path.join(tmp, 'transform')
    fs.mkdirSync(srcDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(path.dirname(srcDir), { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Produces NDJSON from org source files', () => {
    writeOrgDay(srcDir, '2026-04-01', {
      totals_by_ide: [
        { ide: 'vscode', user_initiated_interaction_count: 100 },
        { ide: 'jetbrains', user_initiated_interaction_count: 50 }
      ]
    })
    writeOrgDay(srcDir, '2026-04-02', {
      totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 120 }]
    })

    transformIdeInteractions(srcDir, outDir)

    const outputFile = path.join(outDir, 'ide-interactions.ndjson')
    expect(fs.existsSync(outputFile)).toBe(true)

    const lines = fs
      .readFileSync(outputFile, 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
    expect(lines.length).toBe(2)

    // Most recent first
    const first = JSON.parse(lines[0])
    expect(first.day).toBe('2026-04-02')
  })

  it('Skips with empty source', () => {
    transformIdeInteractions(srcDir, outDir)
    expect(fs.existsSync(path.join(outDir, 'ide-interactions.ndjson'))).toBe(
      false
    )
  })
})

describe('transformFeatureInteractions', () => {
  let srcDir: string
  let outDir: string

  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-feat-'))
    srcDir = path.join(tmp, 'source')
    outDir = path.join(tmp, 'transform')
    fs.mkdirSync(srcDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(path.dirname(srcDir), { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Produces NDJSON from org source files', () => {
    writeOrgDay(srcDir, '2026-04-01', {
      totals_by_feature: [
        { feature: 'code_completions', user_initiated_interaction_count: 200 },
        { feature: 'chat', user_initiated_interaction_count: 80 }
      ]
    })

    transformFeatureInteractions(srcDir, outDir)

    const outputFile = path.join(outDir, 'feature-interactions.ndjson')
    expect(fs.existsSync(outputFile)).toBe(true)

    const lines = fs
      .readFileSync(outputFile, 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
    expect(lines.length).toBe(1)

    const parsed = JSON.parse(lines[0])
    expect(parsed.totals_by_feature.length).toBe(2)
  })

  it('Skips with empty source', () => {
    transformFeatureInteractions(srcDir, outDir)
    expect(
      fs.existsSync(path.join(outDir, 'feature-interactions.ndjson'))
    ).toBe(false)
  })
})

describe('transformDailyUsage', () => {
  let srcDir: string
  let outDir: string
  let usersDir: string

  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-daily-'))
    srcDir = path.join(tmp, 'source')
    outDir = path.join(tmp, 'transform')
    usersDir = path.join(tmp, 'users')
    fs.mkdirSync(srcDir, { recursive: true })
    fs.mkdirSync(usersDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(path.dirname(srcDir), { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Produces daily usage NDJSON with active/inactive lists', () => {
    writeOrgDay(srcDir, '2026-04-01', {
      daily_active_users: 2,
      user_initiated_interaction_count: 150
    })
    writeUserDay(usersDir, '2026-04-01', 'alice', {})
    writeUserDay(usersDir, '2026-04-01', 'bob', {})

    transformDailyUsage(srcDir, outDir, usersDir)

    const outputFile = path.join(outDir, 'daily-usage.ndjson')
    expect(fs.existsSync(outputFile)).toBe(true)

    const parsed = JSON.parse(
      fs.readFileSync(outputFile, 'utf-8').split('\n')[0]
    )
    expect(parsed.day).toBe('2026-04-01')
    expect(parsed.daily_active_users).toBe(2)
    expect(parsed.active_users).toContain('alice')
    expect(parsed.active_users).toContain('bob')
  })

  it('Marks users inactive when they have no data for a day', () => {
    writeOrgDay(srcDir, '2026-04-01', {
      daily_active_users: 1,
      user_initiated_interaction_count: 100
    })
    writeOrgDay(srcDir, '2026-04-02', {
      daily_active_users: 1,
      user_initiated_interaction_count: 50
    })
    // alice active both days, bob only day 1
    writeUserDay(usersDir, '2026-04-01', 'alice', {})
    writeUserDay(usersDir, '2026-04-01', 'bob', {})
    writeUserDay(usersDir, '2026-04-02', 'alice', {})

    transformDailyUsage(srcDir, outDir, usersDir)

    const lines = fs
      .readFileSync(path.join(outDir, 'daily-usage.ndjson'), 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
    // Most recent first
    const day2 = JSON.parse(lines[0])
    expect(day2.day).toBe('2026-04-02')
    expect(day2.active_users).toContain('alice')
    expect(day2.inactive_users).toContain('bob')
  })

  it('Skips with empty source', () => {
    transformDailyUsage(srcDir, outDir, usersDir)
    expect(fs.existsSync(path.join(outDir, 'daily-usage.ndjson'))).toBe(false)
  })
})

describe('transformFeatureAdoption', () => {
  let srcDir: string
  let outDir: string
  let usersDir: string

  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-feat-adopt-'))
    srcDir = path.join(tmp, 'source')
    outDir = path.join(tmp, 'transform')
    usersDir = path.join(tmp, 'users')
    fs.mkdirSync(srcDir, { recursive: true })
    fs.mkdirSync(usersDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(path.dirname(srcDir), { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Produces feature adoption NDJSON with user breakdowns', () => {
    writeOrgDay(srcDir, '2026-04-01', {
      user_initiated_interaction_count: 300,
      totals_by_feature: [
        { feature: 'chat', user_initiated_interaction_count: 200 },
        {
          feature: 'code_completions',
          user_initiated_interaction_count: 100
        }
      ]
    })
    writeUserDay(usersDir, '2026-04-01', 'alice', {
      totals_by_feature: [
        { feature: 'chat', user_initiated_interaction_count: 120 }
      ]
    })
    writeUserDay(usersDir, '2026-04-01', 'bob', {
      totals_by_feature: [
        { feature: 'chat', user_initiated_interaction_count: 80 }
      ]
    })

    transformFeatureAdoption(srcDir, outDir, usersDir)

    const outputFile = path.join(outDir, 'feature-adoption.ndjson')
    expect(fs.existsSync(outputFile)).toBe(true)

    const parsed = JSON.parse(
      fs.readFileSync(outputFile, 'utf-8').split('\n')[0]
    )
    expect(parsed.features.length).toBe(2)
    const chat = parsed.features.find(
      (f: { feature: string }) => f.feature === 'chat'
    )
    expect(chat.users.length).toBe(2)
    // Sorted by interactions desc: alice first
    expect(chat.users[0].login).toBe('alice')
  })

  it('Skips with empty source', () => {
    transformFeatureAdoption(srcDir, outDir, usersDir)
    expect(fs.existsSync(path.join(outDir, 'feature-adoption.ndjson'))).toBe(
      false
    )
  })
})

describe('transformModelAdoption', () => {
  let srcDir: string
  let outDir: string
  let usersDir: string

  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-model-adopt-'))
    srcDir = path.join(tmp, 'source')
    outDir = path.join(tmp, 'transform')
    usersDir = path.join(tmp, 'users')
    fs.mkdirSync(srcDir, { recursive: true })
    fs.mkdirSync(usersDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(path.dirname(srcDir), { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Aggregates models across features and includes user data', () => {
    writeOrgDay(srcDir, '2026-04-01', {
      user_initiated_interaction_count: 500,
      totals_by_model_feature: [
        {
          model: 'gpt-4o',
          feature: 'chat',
          user_initiated_interaction_count: 200
        },
        {
          model: 'gpt-4o',
          feature: 'code_completions',
          user_initiated_interaction_count: 100
        },
        {
          model: 'claude-sonnet',
          feature: 'chat',
          user_initiated_interaction_count: 200
        }
      ]
    })
    writeUserDay(usersDir, '2026-04-01', 'alice', {
      totals_by_model_feature: [
        {
          model: 'gpt-4o',
          feature: 'chat',
          user_initiated_interaction_count: 150
        }
      ]
    })

    transformModelAdoption(srcDir, outDir, usersDir)

    const outputFile = path.join(outDir, 'model-adoption.ndjson')
    expect(fs.existsSync(outputFile)).toBe(true)

    const parsed = JSON.parse(
      fs.readFileSync(outputFile, 'utf-8').split('\n')[0]
    )
    expect(parsed.models.length).toBe(2)
    // gpt-4o aggregated: 200+100 = 300
    const gpt4o = parsed.models.find(
      (m: { model: string }) => m.model === 'gpt-4o'
    )
    expect(gpt4o.interactions).toBe(300)
    expect(gpt4o.users[0].login).toBe('alice')
  })

  it('Skips with empty source', () => {
    transformModelAdoption(srcDir, outDir, usersDir)
    expect(fs.existsSync(path.join(outDir, 'model-adoption.ndjson'))).toBe(
      false
    )
  })
})
