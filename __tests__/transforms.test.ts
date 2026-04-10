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
  let usersDir: string
  let outDir: string

  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-transform-'))
    usersDir = path.join(tmp, 'users')
    outDir = path.join(tmp, 'transform')
    fs.mkdirSync(usersDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(path.dirname(usersDir), { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Aggregates IDE interactions from user source files', () => {
    writeUserDay(usersDir, '2026-04-01', 'alice', {
      totals_by_ide: [
        { ide: 'vscode', user_initiated_interaction_count: 80 },
        { ide: 'jetbrains', user_initiated_interaction_count: 20 }
      ]
    })
    writeUserDay(usersDir, '2026-04-01', 'bob', {
      totals_by_ide: [
        { ide: 'vscode', user_initiated_interaction_count: 20 },
        { ide: 'jetbrains', user_initiated_interaction_count: 30 }
      ]
    })
    writeUserDay(usersDir, '2026-04-02', 'alice', {
      totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 120 }]
    })

    transformIdeInteractions(usersDir, outDir)

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
    expect(first.totals_by_ide[0].ide).toBe('vscode')
    expect(first.totals_by_ide[0].user_initiated_interaction_count).toBe(120)

    // Day 1: vscode=100, jetbrains=50
    const second = JSON.parse(lines[1])
    expect(second.day).toBe('2026-04-01')
    const vscode = second.totals_by_ide.find(
      (i: { ide: string }) => i.ide === 'vscode'
    )
    expect(vscode.user_initiated_interaction_count).toBe(100)
  })

  it('Skips with empty source', () => {
    transformIdeInteractions(usersDir, outDir)
    expect(fs.existsSync(path.join(outDir, 'ide-interactions.ndjson'))).toBe(
      false
    )
  })

  it('Applies include filter', () => {
    writeUserDay(usersDir, '2026-04-01', 'alice', {
      totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 80 }]
    })
    writeUserDay(usersDir, '2026-04-01', 'bob', {
      totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 20 }]
    })

    transformIdeInteractions(usersDir, outDir, ['alice'])

    const lines = fs
      .readFileSync(path.join(outDir, 'ide-interactions.ndjson'), 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
    const parsed = JSON.parse(lines[0])
    // Only alice's 80
    expect(parsed.totals_by_ide[0].user_initiated_interaction_count).toBe(80)
  })

  it('Applies exclude filter', () => {
    writeUserDay(usersDir, '2026-04-01', 'alice', {
      totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 80 }]
    })
    writeUserDay(usersDir, '2026-04-01', 'bob', {
      totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 20 }]
    })

    transformIdeInteractions(usersDir, outDir, [], ['bob'])

    const lines = fs
      .readFileSync(path.join(outDir, 'ide-interactions.ndjson'), 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
    const parsed = JSON.parse(lines[0])
    // Only alice's 80
    expect(parsed.totals_by_ide[0].user_initiated_interaction_count).toBe(80)
  })
})

describe('transformFeatureInteractions', () => {
  let usersDir: string
  let outDir: string

  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-feat-'))
    usersDir = path.join(tmp, 'users')
    outDir = path.join(tmp, 'transform')
    fs.mkdirSync(usersDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(path.dirname(usersDir), { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Aggregates feature interactions from user source files', () => {
    writeUserDay(usersDir, '2026-04-01', 'alice', {
      totals_by_feature: [
        { feature: 'code_completions', user_initiated_interaction_count: 150 },
        { feature: 'chat', user_initiated_interaction_count: 50 }
      ]
    })
    writeUserDay(usersDir, '2026-04-01', 'bob', {
      totals_by_feature: [
        { feature: 'code_completions', user_initiated_interaction_count: 50 },
        { feature: 'chat', user_initiated_interaction_count: 30 }
      ]
    })

    transformFeatureInteractions(usersDir, outDir)

    const outputFile = path.join(outDir, 'feature-interactions.ndjson')
    expect(fs.existsSync(outputFile)).toBe(true)

    const lines = fs
      .readFileSync(outputFile, 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
    expect(lines.length).toBe(1)

    const parsed = JSON.parse(lines[0])
    expect(parsed.totals_by_feature.length).toBe(2)
    // code_completions: 200, chat: 80
    const cc = parsed.totals_by_feature.find(
      (f: { feature: string }) => f.feature === 'code_completions'
    )
    expect(cc.user_initiated_interaction_count).toBe(200)
  })

  it('Skips with empty source', () => {
    transformFeatureInteractions(usersDir, outDir)
    expect(
      fs.existsSync(path.join(outDir, 'feature-interactions.ndjson'))
    ).toBe(false)
  })
})

describe('transformDailyUsage', () => {
  let usersDir: string
  let outDir: string

  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-daily-'))
    usersDir = path.join(tmp, 'users')
    outDir = path.join(tmp, 'transform')
    fs.mkdirSync(usersDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(path.dirname(usersDir), { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Produces daily usage NDJSON with active/inactive lists', () => {
    writeUserDay(usersDir, '2026-04-01', 'alice', {
      user_initiated_interaction_count: 100
    })
    writeUserDay(usersDir, '2026-04-01', 'bob', {
      user_initiated_interaction_count: 50
    })

    transformDailyUsage(usersDir, outDir)

    const outputFile = path.join(outDir, 'daily-usage.ndjson')
    expect(fs.existsSync(outputFile)).toBe(true)

    const parsed = JSON.parse(
      fs.readFileSync(outputFile, 'utf-8').split('\n')[0]
    )
    expect(parsed.day).toBe('2026-04-01')
    expect(parsed.daily_active_users).toBe(2)
    expect(parsed.user_initiated_interaction_count).toBe(150)
    expect(parsed.active_users).toContain('alice')
    expect(parsed.active_users).toContain('bob')
    expect(parsed.active_users_with_interactions).toContain('alice')
    expect(parsed.active_users_with_interactions).toContain('bob')
    expect(parsed.active_users_without_interactions).toEqual([])
  })

  it('Marks users inactive when they have no data for a day', () => {
    writeUserDay(usersDir, '2026-04-01', 'alice', {
      user_initiated_interaction_count: 100
    })
    writeUserDay(usersDir, '2026-04-01', 'bob', {
      user_initiated_interaction_count: 50
    })
    writeUserDay(usersDir, '2026-04-02', 'alice', {
      user_initiated_interaction_count: 80
    })

    transformDailyUsage(usersDir, outDir)

    const lines = fs
      .readFileSync(path.join(outDir, 'daily-usage.ndjson'), 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
    // Most recent first
    const day2 = JSON.parse(lines[0])
    expect(day2.day).toBe('2026-04-02')
    expect(day2.active_users).toContain('alice')
    expect(day2.inactive_users).toContain('bob')
    expect(day2.active_users_with_interactions).toContain('alice')
    expect(day2.active_users_without_interactions).toEqual([])
  })

  it('Skips with empty source', () => {
    transformDailyUsage(usersDir, outDir)
    expect(fs.existsSync(path.join(outDir, 'daily-usage.ndjson'))).toBe(false)
  })

  it('Applies include filter to daily usage', () => {
    writeUserDay(usersDir, '2026-04-01', 'alice', {
      user_initiated_interaction_count: 100
    })
    writeUserDay(usersDir, '2026-04-01', 'bob', {
      user_initiated_interaction_count: 50
    })

    transformDailyUsage(usersDir, outDir, ['alice'])

    const parsed = JSON.parse(
      fs
        .readFileSync(path.join(outDir, 'daily-usage.ndjson'), 'utf-8')
        .split('\n')[0]
    )
    expect(parsed.daily_active_users).toBe(1)
    expect(parsed.active_users).toEqual(['alice'])
    expect(parsed.user_initiated_interaction_count).toBe(100)
  })

  it('Separates active users with and without interactions', () => {
    writeUserDay(usersDir, '2026-04-01', 'alice', {
      user_initiated_interaction_count: 100
    })
    writeUserDay(usersDir, '2026-04-01', 'bob', {
      user_initiated_interaction_count: 0
    })

    transformDailyUsage(usersDir, outDir)

    const parsed = JSON.parse(
      fs
        .readFileSync(path.join(outDir, 'daily-usage.ndjson'), 'utf-8')
        .split('\n')[0]
    )
    expect(parsed.active_users_with_interactions).toEqual(['alice'])
    expect(parsed.active_users_without_interactions).toEqual(['bob'])
    expect(parsed.active_users).toEqual(['alice', 'bob'])
  })
})

describe('transformFeatureAdoption', () => {
  let usersDir: string
  let outDir: string

  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-feat-adopt-'))
    usersDir = path.join(tmp, 'users')
    outDir = path.join(tmp, 'transform')
    fs.mkdirSync(usersDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(path.dirname(usersDir), { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Produces feature adoption NDJSON with user breakdowns', () => {
    writeUserDay(usersDir, '2026-04-01', 'alice', {
      totals_by_feature: [
        { feature: 'chat', user_initiated_interaction_count: 120 },
        { feature: 'code_completions', user_initiated_interaction_count: 80 }
      ]
    })
    writeUserDay(usersDir, '2026-04-01', 'bob', {
      totals_by_feature: [
        { feature: 'chat', user_initiated_interaction_count: 80 }
      ]
    })

    transformFeatureAdoption(usersDir, outDir)

    const outputFile = path.join(outDir, 'feature-adoption.ndjson')
    expect(fs.existsSync(outputFile)).toBe(true)

    const parsed = JSON.parse(
      fs.readFileSync(outputFile, 'utf-8').split('\n')[0]
    )
    expect(parsed.total_interactions).toBe(280)
    const chat = parsed.features.find(
      (f: { feature: string }) => f.feature === 'chat'
    )
    expect(chat.users.length).toBe(2)
    // Sorted by interactions desc: alice first
    expect(chat.users[0].login).toBe('alice')
  })

  it('Skips with empty source', () => {
    transformFeatureAdoption(usersDir, outDir)
    expect(fs.existsSync(path.join(outDir, 'feature-adoption.ndjson'))).toBe(
      false
    )
  })
})

describe('transformModelAdoption', () => {
  let usersDir: string
  let outDir: string

  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-model-adopt-'))
    usersDir = path.join(tmp, 'users')
    outDir = path.join(tmp, 'transform')
    fs.mkdirSync(usersDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(path.dirname(usersDir), { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Aggregates models across features and includes user data', () => {
    writeUserDay(usersDir, '2026-04-01', 'alice', {
      totals_by_model_feature: [
        {
          model: 'gpt-4o',
          feature: 'chat',
          user_initiated_interaction_count: 150
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
    writeUserDay(usersDir, '2026-04-01', 'bob', {
      totals_by_model_feature: [
        {
          model: 'gpt-4o',
          feature: 'chat',
          user_initiated_interaction_count: 50
        }
      ]
    })

    transformModelAdoption(usersDir, outDir)

    const outputFile = path.join(outDir, 'model-adoption.ndjson')
    expect(fs.existsSync(outputFile)).toBe(true)

    const parsed = JSON.parse(
      fs.readFileSync(outputFile, 'utf-8').split('\n')[0]
    )
    expect(parsed.models.length).toBe(2)
    // gpt-4o aggregated: alice 150+100 + bob 50 = 300
    const gpt4o = parsed.models.find(
      (m: { model: string }) => m.model === 'gpt-4o'
    )
    expect(gpt4o.interactions).toBe(300)
    expect(gpt4o.users.length).toBe(2)
    expect(gpt4o.users[0].login).toBe('alice')
    expect(gpt4o.users[0].interactions).toBe(250)
  })

  it('Skips with empty source', () => {
    transformModelAdoption(usersDir, outDir)
    expect(fs.existsSync(path.join(outDir, 'model-adoption.ndjson'))).toBe(
      false
    )
  })
})
