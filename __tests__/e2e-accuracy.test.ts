/**
 * End-to-End Data Accuracy Tests
 *
 * Verifies that numbers in generated reports exactly match hand-computed
 * expected values derived from a controlled fixture dataset.
 *
 * The test creates known source files, runs all 5 transforms, then runs
 * all 7 report generators and verifies every number at each pipeline stage.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ FIXTURE DATASET: 4 users, 5 days, 2 features, 2 IDEs, 2 models    │
 * ├────────────┬──────────┬─────────────┬──────────┬─────────┬─────────┤
 * │ Day        │ Weekday? │ alice       │ bob      │ carol   │ dave    │
 * ├────────────┼──────────┼─────────────┼──────────┼─────────┼─────────┤
 * │ 2026-04-01 │ Wed ✓    │ int=10      │ int=6    │ int=0   │ absent  │
 * │ 2026-04-02 │ Thu ✓    │ int=8       │ int=4    │ int=0   │ absent  │
 * │ 2026-04-03 │ Fri ✓    │ int=12      │ absent   │ int=0   │ absent  │
 * │ 2026-04-04 │ Sat ✗    │ int=2       │ absent   │ absent  │ absent  │
 * │ 2026-04-06 │ Mon ✓    │ int=6       │ absent   │ absent  │ int=3   │
 * └────────────┴──────────┴─────────────┴──────────┴─────────┴─────────┘
 *
 * Features: chat, code_completions
 * IDEs: vscode, jetbrains
 * Models: gpt-4o, claude-sonnet
 *
 * Carol is always active (has a file) but never initiates interactions.
 * This tests the "active without interactions" classification.
 *
 * HAND-COMPUTED TOTALS (audit trail):
 *   All interactions: 10+6+0 + 8+4+0 + 12+0 + 2 + 6+3 = 51
 *   Weekday days: 4 (Apr 1,2,3,6)
 *   Weekday active users sum: 3+3+2+2 = 10 → avg = round(10/4) = 3
 *   Weekday interacting users sum: 2+2+1+2 = 7 → avg = round(7/4) = 2
 *   chat total: 5+4 + 3+4 + 7 + 2 + 6 = 31
 *   code_completions total: 5+2 + 5 + 5 + 0 + 3 = 20
 *   vscode total: 10+4 + 8 + 12 + 2 + 6+3 = 45
 *   jetbrains total: 2 + 4 = 6
 *   gpt-4o total: 10+4 + 8 + 12 + 2 + 6 = 42
 *   claude-sonnet total: 2 + 4 + 3 = 9
 *   Sum check: chat(31) + completions(20) = 51 ✓
 *   Sum check: vscode(45) + jetbrains(6) = 51 ✓
 *   Sum check: gpt-4o(42) + claude-sonnet(9) = 51 ✓
 */

import { jest } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

// Transforms
const { transformDailyUsage } =
  await import('../src/utils/transform/transformDailyUsage.js')
const { transformFeatureInteractions } =
  await import('../src/utils/transform/transformFeatureInteractions.js')
const { transformFeatureAdoption } =
  await import('../src/utils/transform/transformFeatureAdoption.js')
const { transformIdeInteractions } =
  await import('../src/utils/transform/transformIdeInteractions.js')
const { transformModelAdoption } =
  await import('../src/utils/transform/transformModelAdoption.js')

// Report generators
const { generateDailyUsageReport } =
  await import('../src/utils/report/generateDailyUsageReport.js')
const { generateFeatureAdoptionReport } =
  await import('../src/utils/report/generateFeatureAdoptionReport.js')
const { generateIdeAdoptionReport } =
  await import('../src/utils/report/generateIdeAdoptionReport.js')
const { generateModelAdoptionReport } =
  await import('../src/utils/report/generateModelAdoptionReport.js')
const { generatePerFeatureAdoptionReport } =
  await import('../src/utils/report/generatePerFeatureAdoptionReport.js')
const { generatePerModelAdoptionReport } =
  await import('../src/utils/report/generatePerModelAdoptionReport.js')
const { generatePerUserAdoptionReport } =
  await import('../src/utils/report/generatePerUserAdoptionReport.js')

// ---------------------------------------------------------------------------
// Fixture Data — each entry is one source file that will be written
// ---------------------------------------------------------------------------

const FIXTURE_SOURCE_FILES = [
  // ── 2026-04-01 (Wednesday) ──────────────────────────────────────────
  {
    day: '2026-04-01',
    user_login: 'alice',
    user_initiated_interaction_count: 10,
    totals_by_feature: [
      { feature: 'chat', user_initiated_interaction_count: 5 },
      { feature: 'code_completions', user_initiated_interaction_count: 5 }
    ],
    totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 10 }],
    totals_by_model_feature: [
      {
        model: 'gpt-4o',
        feature: 'chat',
        user_initiated_interaction_count: 5
      },
      {
        model: 'gpt-4o',
        feature: 'code_completions',
        user_initiated_interaction_count: 5
      }
    ]
  },
  {
    day: '2026-04-01',
    user_login: 'bob',
    user_initiated_interaction_count: 6,
    totals_by_feature: [
      { feature: 'chat', user_initiated_interaction_count: 4 },
      { feature: 'code_completions', user_initiated_interaction_count: 2 }
    ],
    totals_by_ide: [
      { ide: 'vscode', user_initiated_interaction_count: 4 },
      { ide: 'jetbrains', user_initiated_interaction_count: 2 }
    ],
    totals_by_model_feature: [
      {
        model: 'gpt-4o',
        feature: 'chat',
        user_initiated_interaction_count: 4
      },
      {
        model: 'claude-sonnet',
        feature: 'code_completions',
        user_initiated_interaction_count: 2
      }
    ]
  },
  {
    day: '2026-04-01',
    user_login: 'carol',
    user_initiated_interaction_count: 0
    // No features/IDEs/models — active but no interactions
  },

  // ── 2026-04-02 (Thursday) ──────────────────────────────────────────
  {
    day: '2026-04-02',
    user_login: 'alice',
    user_initiated_interaction_count: 8,
    totals_by_feature: [
      { feature: 'chat', user_initiated_interaction_count: 3 },
      { feature: 'code_completions', user_initiated_interaction_count: 5 }
    ],
    totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 8 }],
    totals_by_model_feature: [
      {
        model: 'gpt-4o',
        feature: 'chat',
        user_initiated_interaction_count: 3
      },
      {
        model: 'gpt-4o',
        feature: 'code_completions',
        user_initiated_interaction_count: 5
      }
    ]
  },
  {
    day: '2026-04-02',
    user_login: 'bob',
    user_initiated_interaction_count: 4,
    totals_by_feature: [
      { feature: 'chat', user_initiated_interaction_count: 4 }
    ],
    totals_by_ide: [{ ide: 'jetbrains', user_initiated_interaction_count: 4 }],
    totals_by_model_feature: [
      {
        model: 'claude-sonnet',
        feature: 'chat',
        user_initiated_interaction_count: 4
      }
    ]
  },
  {
    day: '2026-04-02',
    user_login: 'carol',
    user_initiated_interaction_count: 0
  },

  // ── 2026-04-03 (Friday) ────────────────────────────────────────────
  {
    day: '2026-04-03',
    user_login: 'alice',
    user_initiated_interaction_count: 12,
    totals_by_feature: [
      { feature: 'chat', user_initiated_interaction_count: 7 },
      { feature: 'code_completions', user_initiated_interaction_count: 5 }
    ],
    totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 12 }],
    totals_by_model_feature: [
      {
        model: 'gpt-4o',
        feature: 'chat',
        user_initiated_interaction_count: 7
      },
      {
        model: 'gpt-4o',
        feature: 'code_completions',
        user_initiated_interaction_count: 5
      }
    ]
  },
  {
    day: '2026-04-03',
    user_login: 'carol',
    user_initiated_interaction_count: 0
  },

  // ── 2026-04-04 (Saturday — weekend!) ───────────────────────────────
  {
    day: '2026-04-04',
    user_login: 'alice',
    user_initiated_interaction_count: 2,
    totals_by_feature: [
      { feature: 'chat', user_initiated_interaction_count: 2 }
    ],
    totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 2 }],
    totals_by_model_feature: [
      {
        model: 'gpt-4o',
        feature: 'chat',
        user_initiated_interaction_count: 2
      }
    ]
  },

  // ── 2026-04-06 (Monday — new week W15) ─────────────────────────────
  {
    day: '2026-04-06',
    user_login: 'alice',
    user_initiated_interaction_count: 6,
    totals_by_feature: [
      { feature: 'chat', user_initiated_interaction_count: 6 }
    ],
    totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 6 }],
    totals_by_model_feature: [
      {
        model: 'gpt-4o',
        feature: 'chat',
        user_initiated_interaction_count: 6
      }
    ]
  },
  {
    day: '2026-04-06',
    user_login: 'dave',
    user_initiated_interaction_count: 3,
    totals_by_feature: [
      { feature: 'code_completions', user_initiated_interaction_count: 3 }
    ],
    totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 3 }],
    totals_by_model_feature: [
      {
        model: 'claude-sonnet',
        feature: 'code_completions',
        user_initiated_interaction_count: 3
      }
    ]
  }
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Write a source file at the expected path for a user-day */
const writeSourceFile = (usersDir: string, entry: Record<string, unknown>) => {
  const day = entry.day as string
  const login = entry.user_login as string
  const dayDir = path.join(usersDir, day)
  if (!fs.existsSync(dayDir)) fs.mkdirSync(dayDir, { recursive: true })
  fs.writeFileSync(
    path.join(dayDir, `${day}-${login}.json`),
    JSON.stringify(entry)
  )
}

/** Read an NDJSON file and parse into an array of objects */
const readNdjson = <T>(filePath: string): T[] => {
  const content = fs.readFileSync(filePath, 'utf-8')
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T)
}

/**
 * Parse a markdown table occurring after a given text marker.
 * Returns an array of row objects keyed by column header.
 * Handles empty cells correctly (e.g. "| | " between pipes).
 */
const parseTable = (
  markdown: string,
  after: string
): { headers: string[]; rows: Record<string, string>[] } => {
  const idx = markdown.indexOf(after)
  if (idx === -1) throw new Error(`Marker "${after}" not found in markdown`)
  const rest = markdown.substring(idx)
  const lines = rest.split('\n')

  const headerIdx = lines.findIndex((l) => l.trim().startsWith('|'))
  if (headerIdx === -1) throw new Error(`No table found after "${after}"`)

  // slice(1, -1) removes leading/trailing empty strings from | delimiters
  const headers = lines[headerIdx]
    .split('|')
    .slice(1, -1)
    .map((s) => s.trim())

  const rows: Record<string, string>[] = []
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('|')) break
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((s) => s.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, j) => {
      row[h] = cells[j] || ''
    })
    rows.push(row)
  }

  return { headers, rows }
}

/** Find a specific row in a parsed table by the first column value */
const findRow = (
  rows: Record<string, string>[],
  firstCol: string
): Record<string, string> => {
  const row = rows.find((r) => Object.values(r)[0] === firstCol)
  if (!row) throw new Error(`Row "${firstCol}" not found`)
  return row
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('End-to-End Data Accuracy', () => {
  let tmpDir: string
  let usersDir: string
  let transformDir: string

  // NDJSON parsed data (populated in beforeAll)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dailyUsage: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let featureInteractions: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ideInteractions: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let featureAdoption: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let modelAdoption: any[]

  // Report markdown (populated in beforeAll)
  let aiAdoptionMd: string
  let featureAdoptionMd: string
  let ideAdoptionMd: string
  let modelAdoptionMd: string
  let perFeatureChatMd: string
  let perFeatureCompletionsMd: string
  let perModelGpt4oMd: string
  let perModelClaudeMd: string
  let perUserMd: string

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-accuracy-'))
    usersDir = path.join(tmpDir, 'users')
    transformDir = path.join(tmpDir, 'transform')
    fs.mkdirSync(usersDir, { recursive: true })

    // Write all source files
    for (const entry of FIXTURE_SOURCE_FILES) {
      writeSourceFile(usersDir, entry as unknown as Record<string, unknown>)
    }

    // Run all 5 transforms
    transformDailyUsage(usersDir, transformDir)
    transformFeatureInteractions(usersDir, transformDir)
    transformFeatureAdoption(usersDir, transformDir)
    transformIdeInteractions(usersDir, transformDir)
    transformModelAdoption(usersDir, transformDir)

    // Parse NDJSON outputs
    dailyUsage = readNdjson(path.join(transformDir, 'daily-usage.ndjson'))
    featureInteractions = readNdjson(
      path.join(transformDir, 'feature-interactions.ndjson')
    )
    ideInteractions = readNdjson(
      path.join(transformDir, 'ide-interactions.ndjson')
    )
    featureAdoption = readNdjson(
      path.join(transformDir, 'feature-adoption.ndjson')
    )
    modelAdoption = readNdjson(path.join(transformDir, 'model-adoption.ndjson'))

    // Run all report generators
    const aiAdoption = generateDailyUsageReport(transformDir)
    aiAdoptionMd = aiAdoption[0].content

    const featureAdoptionRpt = generateFeatureAdoptionReport(transformDir)
    featureAdoptionMd = featureAdoptionRpt[0].content

    const ideAdoptionRpt = generateIdeAdoptionReport(transformDir)
    ideAdoptionMd = ideAdoptionRpt[0].content

    const modelAdoptionRpt = generateModelAdoptionReport(transformDir)
    modelAdoptionMd = modelAdoptionRpt[0].content

    const perFeatureRpt = generatePerFeatureAdoptionReport(transformDir)
    perFeatureChatMd = perFeatureRpt.find((r) =>
      r.filename.includes('chat')
    )!.content
    // slug: code_completions → code-completions
    perFeatureCompletionsMd = perFeatureRpt.find((r) =>
      r.filename.includes('code-completions')
    )!.content

    const perModelRpt = generatePerModelAdoptionReport(transformDir)
    perModelGpt4oMd = perModelRpt.find((r) =>
      r.filename.includes('gpt-4o')
    )!.content
    perModelClaudeMd = perModelRpt.find((r) =>
      r.filename.includes('claude-sonnet')
    )!.content

    const perUserRpt = generatePerUserAdoptionReport(transformDir)
    perUserMd = perUserRpt[0].content
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Stage 1: Cross-Validation (totals must be consistent across transforms)
  // ─────────────────────────────────────────────────────────────────────

  describe('Cross-Validation: Totals Consistency', () => {
    it('Total interactions across all days = 51 in daily-usage', () => {
      // 10+6+0 + 8+4+0 + 12+0 + 2 + 6+3 = 51
      const total = dailyUsage.reduce(
        (sum: number, d: { user_initiated_interaction_count: number }) =>
          sum + d.user_initiated_interaction_count,
        0
      )
      expect(total).toBe(51)
    })

    it('Total interactions in feature-interactions = 51', () => {
      const total = featureInteractions.reduce(
        (
          sum: number,
          d: {
            totals_by_feature: {
              user_initiated_interaction_count: number
            }[]
          }
        ) =>
          sum +
          d.totals_by_feature.reduce(
            (s: number, f) => s + f.user_initiated_interaction_count,
            0
          ),
        0
      )
      expect(total).toBe(51)
    })

    it('Total interactions in ide-interactions = 51', () => {
      const total = ideInteractions.reduce(
        (
          sum: number,
          d: {
            totals_by_ide: { user_initiated_interaction_count: number }[]
          }
        ) =>
          sum +
          d.totals_by_ide.reduce(
            (s: number, f) => s + f.user_initiated_interaction_count,
            0
          ),
        0
      )
      expect(total).toBe(51)
    })

    it('Total interactions in feature-adoption = 51', () => {
      const total = featureAdoption.reduce(
        (sum: number, d: { total_interactions: number }) =>
          sum + d.total_interactions,
        0
      )
      expect(total).toBe(51)
    })

    it('Total interactions in model-adoption = 51', () => {
      const total = modelAdoption.reduce(
        (sum: number, d: { total_interactions: number }) =>
          sum + d.total_interactions,
        0
      )
      expect(total).toBe(51)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Stage 2: Transform — daily-usage.ndjson
  // ─────────────────────────────────────────────────────────────────────

  describe('Transform: daily-usage.ndjson', () => {
    it('Contains 5 days sorted most recent first', () => {
      expect(dailyUsage.length).toBe(5)
      expect(dailyUsage.map((d: { day: string }) => d.day)).toEqual([
        '2026-04-06',
        '2026-04-04',
        '2026-04-03',
        '2026-04-02',
        '2026-04-01'
      ])
    })

    // Helper to find a day entry
    const getDay = (day: string) =>
      dailyUsage.find((d: { day: string }) => d.day === day)

    it('2026-04-01: 3 active (alice,bob,carol), 2 with interactions, 1 without', () => {
      const d = getDay('2026-04-01')
      expect(d.daily_active_users).toBe(3)
      expect(d.user_initiated_interaction_count).toBe(16) // 10+6+0
      expect(d.active_users).toEqual(['alice', 'bob', 'carol'])
      expect(d.active_users_with_interactions).toEqual(['alice', 'bob'])
      expect(d.active_users_without_interactions).toEqual(['carol'])
      expect(d.inactive_users).toEqual(['dave'])
    })

    it('2026-04-02: 3 active (alice,bob,carol), 2 with interactions, 1 without', () => {
      const d = getDay('2026-04-02')
      expect(d.daily_active_users).toBe(3)
      expect(d.user_initiated_interaction_count).toBe(12) // 8+4+0
      expect(d.active_users_with_interactions).toEqual(['alice', 'bob'])
      expect(d.active_users_without_interactions).toEqual(['carol'])
      expect(d.inactive_users).toEqual(['dave'])
    })

    it('2026-04-03: 2 active (alice,carol), 1 with interactions, 1 without', () => {
      const d = getDay('2026-04-03')
      expect(d.daily_active_users).toBe(2)
      expect(d.user_initiated_interaction_count).toBe(12)
      expect(d.active_users_with_interactions).toEqual(['alice'])
      expect(d.active_users_without_interactions).toEqual(['carol'])
      expect(d.inactive_users).toEqual(['bob', 'dave'])
    })

    it('2026-04-04 (Saturday): 1 active (alice), no inactive carol/bob/dave', () => {
      const d = getDay('2026-04-04')
      expect(d.daily_active_users).toBe(1)
      expect(d.user_initiated_interaction_count).toBe(2)
      expect(d.active_users_with_interactions).toEqual(['alice'])
      expect(d.active_users_without_interactions).toEqual([])
      expect(d.inactive_users).toEqual(['bob', 'carol', 'dave'])
    })

    it('2026-04-06: 2 active (alice,dave), both with interactions', () => {
      const d = getDay('2026-04-06')
      expect(d.daily_active_users).toBe(2)
      expect(d.user_initiated_interaction_count).toBe(9) // 6+3
      expect(d.active_users_with_interactions).toEqual(['alice', 'dave'])
      expect(d.active_users_without_interactions).toEqual([])
      expect(d.inactive_users).toEqual(['bob', 'carol'])
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Stage 2: Transform — feature-interactions.ndjson
  // ─────────────────────────────────────────────────────────────────────

  describe('Transform: feature-interactions.ndjson', () => {
    const getDay = (day: string) =>
      featureInteractions.find((d: { day: string }) => d.day === day)
    const getFeature = (
      day: {
        totals_by_feature: {
          feature: string
          user_initiated_interaction_count: number
        }[]
      },
      feature: string
    ) => day.totals_by_feature.find((f) => f.feature === feature)

    it('2026-04-01: chat=9 (alice:5+bob:4), completions=7 (alice:5+bob:2)', () => {
      const d = getDay('2026-04-01')
      expect(getFeature(d, 'chat')?.user_initiated_interaction_count).toBe(9)
      expect(
        getFeature(d, 'code_completions')?.user_initiated_interaction_count
      ).toBe(7)
    })

    it('2026-04-02: chat=7 (alice:3+bob:4), completions=5 (alice:5)', () => {
      const d = getDay('2026-04-02')
      expect(getFeature(d, 'chat')?.user_initiated_interaction_count).toBe(7)
      expect(
        getFeature(d, 'code_completions')?.user_initiated_interaction_count
      ).toBe(5)
    })

    it('2026-04-04 (Sat): chat=2 only, no completions', () => {
      const d = getDay('2026-04-04')
      expect(getFeature(d, 'chat')?.user_initiated_interaction_count).toBe(2)
      expect(getFeature(d, 'code_completions')).toBeUndefined()
    })

    it('2026-04-06: chat=6 (alice), completions=3 (dave)', () => {
      const d = getDay('2026-04-06')
      expect(getFeature(d, 'chat')?.user_initiated_interaction_count).toBe(6)
      expect(
        getFeature(d, 'code_completions')?.user_initiated_interaction_count
      ).toBe(3)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Stage 2: Transform — ide-interactions.ndjson
  // ─────────────────────────────────────────────────────────────────────

  describe('Transform: ide-interactions.ndjson', () => {
    const getDay = (day: string) =>
      ideInteractions.find((d: { day: string }) => d.day === day)
    const getIde = (
      day: {
        totals_by_ide: {
          ide: string
          user_initiated_interaction_count: number
        }[]
      },
      ide: string
    ) => day.totals_by_ide.find((i) => i.ide === ide)

    it('2026-04-01: vscode=14 (alice:10+bob:4), jetbrains=2 (bob:2)', () => {
      const d = getDay('2026-04-01')
      expect(getIde(d, 'vscode')?.user_initiated_interaction_count).toBe(14)
      expect(getIde(d, 'jetbrains')?.user_initiated_interaction_count).toBe(2)
    })

    it('2026-04-02: vscode=8, jetbrains=4', () => {
      const d = getDay('2026-04-02')
      expect(getIde(d, 'vscode')?.user_initiated_interaction_count).toBe(8)
      expect(getIde(d, 'jetbrains')?.user_initiated_interaction_count).toBe(4)
    })

    it('2026-04-06: vscode=9 (alice:6+dave:3), no jetbrains', () => {
      const d = getDay('2026-04-06')
      expect(getIde(d, 'vscode')?.user_initiated_interaction_count).toBe(9)
      expect(getIde(d, 'jetbrains')).toBeUndefined()
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Stage 2: Transform — feature-adoption.ndjson
  // ─────────────────────────────────────────────────────────────────────

  describe('Transform: feature-adoption.ndjson', () => {
    const getDay = (day: string) =>
      featureAdoption.find((d: { day: string }) => d.day === day)
    const getFeature = (
      day: {
        features: {
          feature: string
          interactions: number
          users: { login: string; interactions: number }[]
        }[]
      },
      feature: string
    ) => day.features.find((f) => f.feature === feature)

    it('2026-04-01: total=16, chat=9 with users alice(5)+bob(4)', () => {
      const d = getDay('2026-04-01')
      expect(d.total_interactions).toBe(16)

      const chat = getFeature(d, 'chat')!
      expect(chat.interactions).toBe(9)
      expect(chat.users).toEqual([
        { login: 'alice', interactions: 5 },
        { login: 'bob', interactions: 4 }
      ])
    })

    it('2026-04-01: code_completions=7 with alice(5)+bob(2)', () => {
      const d = getDay('2026-04-01')
      const comp = getFeature(d, 'code_completions')!
      expect(comp.interactions).toBe(7)
      expect(comp.users).toEqual([
        { login: 'alice', interactions: 5 },
        { login: 'bob', interactions: 2 }
      ])
    })

    it('2026-04-06: total=9, chat=6 alice-only, completions=3 dave-only', () => {
      const d = getDay('2026-04-06')
      expect(d.total_interactions).toBe(9)

      const chat = getFeature(d, 'chat')!
      expect(chat.interactions).toBe(6)
      expect(chat.users).toEqual([{ login: 'alice', interactions: 6 }])

      const comp = getFeature(d, 'code_completions')!
      expect(comp.interactions).toBe(3)
      expect(comp.users).toEqual([{ login: 'dave', interactions: 3 }])
    })

    it('Carol never appears in feature-adoption (has no feature data)', () => {
      for (const day of featureAdoption) {
        for (const f of day.features) {
          const carolUser = f.users.find(
            (u: { login: string }) => u.login === 'carol'
          )
          expect(carolUser).toBeUndefined()
        }
      }
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Stage 2: Transform — model-adoption.ndjson
  // ─────────────────────────────────────────────────────────────────────

  describe('Transform: model-adoption.ndjson', () => {
    const getDay = (day: string) =>
      modelAdoption.find((d: { day: string }) => d.day === day)
    const getModel = (
      day: {
        models: {
          model: string
          interactions: number
          users: { login: string; interactions: number }[]
        }[]
      },
      model: string
    ) => day.models.find((m) => m.model === model)

    it('2026-04-01: gpt-4o=14 (alice:10 across 2 features, bob:4)', () => {
      // alice: gpt-4o chat=5 + gpt-4o completions=5 = 10
      // bob: gpt-4o chat=4
      const d = getDay('2026-04-01')
      const gpt = getModel(d, 'gpt-4o')!
      expect(gpt.interactions).toBe(14)
      expect(gpt.users).toEqual([
        { login: 'alice', interactions: 10 },
        { login: 'bob', interactions: 4 }
      ])
    })

    it('2026-04-01: claude-sonnet=2 (bob:2)', () => {
      const d = getDay('2026-04-01')
      const claude = getModel(d, 'claude-sonnet')!
      expect(claude.interactions).toBe(2)
      expect(claude.users).toEqual([{ login: 'bob', interactions: 2 }])
    })

    it('2026-04-02: gpt-4o=8 (alice), claude-sonnet=4 (bob), total=12', () => {
      const d = getDay('2026-04-02')
      expect(d.total_interactions).toBe(12)
      expect(getModel(d, 'gpt-4o')?.interactions).toBe(8)
      expect(getModel(d, 'claude-sonnet')?.interactions).toBe(4)
    })

    it('2026-04-03: gpt-4o=12 (alice), no claude-sonnet', () => {
      const d = getDay('2026-04-03')
      expect(getModel(d, 'gpt-4o')?.interactions).toBe(12)
      expect(getModel(d, 'claude-sonnet')).toBeUndefined()
    })

    it('2026-04-06: gpt-4o=6 (alice), claude-sonnet=3 (dave)', () => {
      const d = getDay('2026-04-06')
      expect(getModel(d, 'gpt-4o')?.interactions).toBe(6)
      expect(getModel(d, 'claude-sonnet')?.interactions).toBe(3)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Stage 3: Report — AI Adoption (daily-usage → monthly + weekly)
  // ─────────────────────────────────────────────────────────────────────

  describe('Report: AI Adoption', () => {
    it('Monthly: avg active=3, avg interacting=2, total=51', () => {
      // Weekday active: 3+3+2+2=10, days=4, avg=round(10/4)=round(2.5)=3
      // Weekday interacting: 2+2+1+2=7, days=4, avg=round(7/4)=round(1.75)=2
      const table = parseTable(aiAdoptionMd, '## Monthly')
      const row = findRow(table.rows, '2026-04')

      expect(row['Avg Active Users / Day (weekdays)']).toBe('3')
      expect(row['Avg Interacting Users / Day (weekdays)']).toBe('2')
      expect(row['User Initiated Interactions']).toBe('51')
    })

    it('Monthly: most/least interactions ranked by frequency', () => {
      // alice: 5 days with interactions, bob: 2, dave: 1
      const table = parseTable(aiAdoptionMd, '## Monthly')
      const row = findRow(table.rows, '2026-04')
      expect(row['Most Interactions (5)']).toBe('alice, bob, dave')
      expect(row['Least Interactions (5)']).toBe('dave, bob, alice')
    })

    it('Weekly W14: 2 with interactions, 1 without, interactions=42', () => {
      // W14 = Apr 1-4: alice+bob have interactions, carol active without
      // interactions: 16+12+12+2 = 42
      const table = parseTable(aiAdoptionMd, '## Weekly')
      const row = findRow(table.rows, '2026-W14')

      expect(row['Active Users with Interactions']).toBe('2')
      expect(row['Active Users without Interactions']).toBe('1')
      expect(row['User Initiated Interactions']).toBe('42')
      expect(row['Active Users with Interactions List']).toBe('alice, bob')
      expect(row['Active Users without Interactions List']).toBe('carol')
      expect(row['Inactive Users']).toBe('dave')
    })

    it('Weekly W15: 2 with interactions, 0 without, interactions=9', () => {
      // W15 = Apr 6: alice+dave both have interactions
      const table = parseTable(aiAdoptionMd, '## Weekly')
      const row = findRow(table.rows, '2026-W15')

      expect(row['Active Users with Interactions']).toBe('2')
      expect(row['Active Users without Interactions']).toBe('0')
      expect(row['User Initiated Interactions']).toBe('9')
      expect(row['Active Users with Interactions List']).toBe('alice, dave')
      expect(row['Inactive Users']).toBe('bob, carol')
    })

    it('Contains Definitions section', () => {
      expect(aiAdoptionMd).toContain('## Definitions')
      expect(aiAdoptionMd).toContain('**Active Users**')
      expect(aiAdoptionMd).toContain('**Interacting Users**')
      expect(aiAdoptionMd).toContain('**Inactive Users**')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Stage 3: Report — Feature Adoption (feature-interactions → table)
  // ─────────────────────────────────────────────────────────────────────

  describe('Report: Feature Adoption', () => {
    it('Monthly: chat=31 (61%), completions=20 (39%), total=51', () => {
      // chat: 9+7+7+2+6=31, completions: 7+5+5+0+3=20
      // chat%: round(31/51*100)=61, completions%: round(20/51*100)=39
      const table = parseTable(featureAdoptionMd, '## Monthly')
      const row = findRow(table.rows, '2026-04')

      expect(row['chat']).toBe('31 (61%)')
      expect(row['code_completions']).toBe('20 (39%)')
      expect(row['Total']).toBe('**51**')
    })

    it('Weekly W14: chat=25 (60%), completions=17 (40%), total=42', () => {
      const table = parseTable(featureAdoptionMd, '## Weekly')
      const row = findRow(table.rows, '2026-W14')

      expect(row['chat']).toBe('25 (60%)')
      expect(row['code_completions']).toBe('17 (40%)')
      expect(row['Total']).toBe('**42**')
    })

    it('Weekly W15: chat=6 (67%), completions=3 (33%), total=9', () => {
      const table = parseTable(featureAdoptionMd, '## Weekly')
      const row = findRow(table.rows, '2026-W15')

      expect(row['chat']).toBe('6 (67%)')
      expect(row['code_completions']).toBe('3 (33%)')
      expect(row['Total']).toBe('**9**')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Stage 3: Report — IDE Adoption (ide-interactions → table)
  // ─────────────────────────────────────────────────────────────────────

  describe('Report: IDE Adoption', () => {
    it('Monthly: vscode=45 (88%), jetbrains=6 (12%), total=51', () => {
      // vscode: 14+8+12+2+9=45, jetbrains: 2+4=6
      // vscode%: round(45/51*100)=88, jetbrains%: round(6/51*100)=12
      const table = parseTable(ideAdoptionMd, '## Monthly')
      const row = findRow(table.rows, '2026-04')

      expect(row['vscode']).toBe('45 (88%)')
      expect(row['jetbrains']).toBe('6 (12%)')
      expect(row['Total']).toBe('**51**')
    })

    it('Weekly W14: vscode=36 (86%), jetbrains=6 (14%), total=42', () => {
      const table = parseTable(ideAdoptionMd, '## Weekly')
      const row = findRow(table.rows, '2026-W14')

      expect(row['vscode']).toBe('36 (86%)')
      expect(row['jetbrains']).toBe('6 (14%)')
      expect(row['Total']).toBe('**42**')
    })

    it('Weekly W15: vscode=9 (100%), no jetbrains, total=9', () => {
      const table = parseTable(ideAdoptionMd, '## Weekly')
      const row = findRow(table.rows, '2026-W15')

      expect(row['vscode']).toBe('9 (100%)')
      expect(row['jetbrains']).toBe('0')
      expect(row['Total']).toBe('**9**')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Stage 3: Report — Model Adoption (model-adoption → table)
  // ─────────────────────────────────────────────────────────────────────

  describe('Report: Model Adoption', () => {
    it('Monthly: gpt-4o=42 (82%), claude-sonnet=9 (18%), total=51', () => {
      // gpt-4o: 14+8+12+2+6=42, claude-sonnet: 2+4+3=9
      // Neither is below 5% threshold, so no "Others" bucket
      const table = parseTable(modelAdoptionMd, '## Monthly')
      const row = findRow(table.rows, '2026-04')

      expect(row['gpt-4o']).toBe('42 (82%)')
      expect(row['claude-sonnet']).toBe('9 (18%)')
      expect(row['Total']).toBe('**51**')
    })

    it('No "Others" bucket (both models > 5%)', () => {
      expect(modelAdoptionMd).not.toContain('Others')
    })

    it('Weekly W14: gpt-4o=36 (86%), claude-sonnet=6 (14%)', () => {
      const table = parseTable(modelAdoptionMd, '## Weekly')
      const row = findRow(table.rows, '2026-W14')

      expect(row['gpt-4o']).toBe('36 (86%)')
      expect(row['claude-sonnet']).toBe('6 (14%)')
      expect(row['Total']).toBe('**42**')
    })

    it('Weekly W15: gpt-4o=6 (67%), claude-sonnet=3 (33%)', () => {
      const table = parseTable(modelAdoptionMd, '## Weekly')
      const row = findRow(table.rows, '2026-W15')

      expect(row['gpt-4o']).toBe('6 (67%)')
      expect(row['claude-sonnet']).toBe('3 (33%)')
      expect(row['Total']).toBe('**9**')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Stage 3: Report — Per-Feature Adoption (chat)
  // ─────────────────────────────────────────────────────────────────────

  describe('Report: Per-Feature — chat', () => {
    it('Monthly: feature=31, total=51, %=61%, users ranked', () => {
      // alice: 5+3+7+2+6=23, bob: 4+4=8 → sorted: alice(23), bob(8)
      const table = parseTable(perFeatureChatMd, '## Monthly')
      const row = findRow(table.rows, '2026-04')

      expect(row['Feature Interactions']).toBe('31')
      expect(row['Total Interactions']).toBe('51')
      expect(row['% of Total']).toBe('61%')
      expect(row['Most Active (top 5)']).toBe('alice, bob')
      expect(row['Least Active (bottom 5)']).toBe('bob, alice')
    })

    it('Weekly W14: feature=25, total=42, %=60%, active=[alice,bob]', () => {
      const table = parseTable(perFeatureChatMd, '## Weekly')
      const row = findRow(table.rows, '2026-W14')

      expect(row['Feature Interactions']).toBe('25')
      expect(row['Total Interactions']).toBe('42')
      expect(row['% of Total']).toBe('60%')
      expect(row['Active Users']).toBe('alice, bob')
    })

    it('Weekly W15: feature=6, total=9, %=67%, active=[alice]', () => {
      const table = parseTable(perFeatureChatMd, '## Weekly')
      const row = findRow(table.rows, '2026-W15')

      expect(row['Feature Interactions']).toBe('6')
      expect(row['Total Interactions']).toBe('9')
      expect(row['% of Total']).toBe('67%')
      expect(row['Active Users']).toBe('alice')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Stage 3: Report — Per-Feature Adoption (code_completions)
  // ─────────────────────────────────────────────────────────────────────

  describe('Report: Per-Feature — code_completions', () => {
    it('Monthly: feature=20, total=51, %=39%, users ranked', () => {
      // alice:15, dave:3, bob:2 → sorted desc
      const table = parseTable(perFeatureCompletionsMd, '## Monthly')
      const row = findRow(table.rows, '2026-04')

      expect(row['Feature Interactions']).toBe('20')
      expect(row['Total Interactions']).toBe('51')
      expect(row['% of Total']).toBe('39%')
      expect(row['Most Active (top 5)']).toBe('alice, dave, bob')
      expect(row['Least Active (bottom 5)']).toBe('bob, dave, alice')
    })

    it('Weekly W14: feature=17, total=42, %=40%', () => {
      const table = parseTable(perFeatureCompletionsMd, '## Weekly')
      const row = findRow(table.rows, '2026-W14')

      expect(row['Feature Interactions']).toBe('17')
      expect(row['Total Interactions']).toBe('42')
      expect(row['% of Total']).toBe('40%')
      expect(row['Active Users']).toBe('alice, bob')
    })

    it('Weekly W15: feature=3, total=9, %=33%, active=[dave]', () => {
      const table = parseTable(perFeatureCompletionsMd, '## Weekly')
      const row = findRow(table.rows, '2026-W15')

      expect(row['Feature Interactions']).toBe('3')
      expect(row['% of Total']).toBe('33%')
      expect(row['Active Users']).toBe('dave')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Stage 3: Report — Per-Model Adoption (gpt-4o)
  // ─────────────────────────────────────────────────────────────────────

  describe('Report: Per-Model — gpt-4o', () => {
    it('Monthly: model=42, total=51, %=82%, users ranked', () => {
      // alice: 10+8+12+2+6=38, bob: 4
      const table = parseTable(perModelGpt4oMd, '## Monthly')
      const row = findRow(table.rows, '2026-04')

      expect(row['Model Interactions']).toBe('42')
      expect(row['Total Interactions']).toBe('51')
      expect(row['% of Total']).toBe('82%')
      expect(row['Most Active (top 5)']).toBe('alice, bob')
      expect(row['Least Active (bottom 5)']).toBe('bob, alice')
    })

    it('Weekly W14: model=36, total=42, %=86%', () => {
      const table = parseTable(perModelGpt4oMd, '## Weekly')
      const row = findRow(table.rows, '2026-W14')

      expect(row['Model Interactions']).toBe('36')
      expect(row['Total Interactions']).toBe('42')
      expect(row['% of Total']).toBe('86%')
      expect(row['Active Users']).toBe('alice, bob')
    })

    it('Weekly W15: model=6, total=9, %=67%, active=[alice]', () => {
      const table = parseTable(perModelGpt4oMd, '## Weekly')
      const row = findRow(table.rows, '2026-W15')

      expect(row['Model Interactions']).toBe('6')
      expect(row['% of Total']).toBe('67%')
      expect(row['Active Users']).toBe('alice')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Stage 3: Report — Per-Model Adoption (claude-sonnet)
  // ─────────────────────────────────────────────────────────────────────

  describe('Report: Per-Model — claude-sonnet', () => {
    it('Monthly: model=9, total=51, %=18%, users ranked', () => {
      // bob: 2+4=6, dave: 3
      const table = parseTable(perModelClaudeMd, '## Monthly')
      const row = findRow(table.rows, '2026-04')

      expect(row['Model Interactions']).toBe('9')
      expect(row['Total Interactions']).toBe('51')
      expect(row['% of Total']).toBe('18%')
      expect(row['Most Active (top 5)']).toBe('bob, dave')
      expect(row['Least Active (bottom 5)']).toBe('dave, bob')
    })

    it('Weekly W14: model=6, total=42, %=14%, active=[bob]', () => {
      const table = parseTable(perModelClaudeMd, '## Weekly')
      const row = findRow(table.rows, '2026-W14')

      expect(row['Model Interactions']).toBe('6')
      expect(row['% of Total']).toBe('14%')
      expect(row['Active Users']).toBe('bob')
    })

    it('Weekly W15: model=3, total=9, %=33%, active=[dave]', () => {
      const table = parseTable(perModelClaudeMd, '## Weekly')
      const row = findRow(table.rows, '2026-W15')

      expect(row['Model Interactions']).toBe('3')
      expect(row['% of Total']).toBe('33%')
      expect(row['Active Users']).toBe('dave')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Stage 3: Report — Per-User Adoption
  // ─────────────────────────────────────────────────────────────────────

  describe('Report: Per-User Adoption', () => {
    it('Users ordered by total interactions: alice(38), bob(10), dave(3)', () => {
      // Carol has no feature data so she is absent
      const aliceIdx = perUserMd.indexOf('## alice')
      const bobIdx = perUserMd.indexOf('## bob')
      const daveIdx = perUserMd.indexOf('## dave')

      expect(aliceIdx).toBeGreaterThan(-1)
      expect(bobIdx).toBeGreaterThan(-1)
      expect(daveIdx).toBeGreaterThan(-1)
      expect(aliceIdx).toBeLessThan(bobIdx)
      expect(bobIdx).toBeLessThan(daveIdx)
      expect(perUserMd).not.toContain('## carol')
    })

    it('alice: avg daily=9, total=38, chat=23, completions=15', () => {
      // Weekday interactions: 10+8+12+6=36, weekday days (global): 4
      // avg = round(36/4) = 9
      const table = parseTable(perUserMd, '## alice')
      const row = findRow(table.rows, '2026-04')

      expect(row['Avg Daily Interactions (weekdays)']).toBe('9')
      expect(row['Total Interactions']).toBe('38')
      expect(row['chat']).toBe('23')
      expect(row['code_completions']).toBe('15')
    })

    it('bob: avg daily=3, total=10, chat=8, completions=2', () => {
      // bob weekday interactions: 6+4=10 / 4 global weekday days = round(2.5)=3
      const table = parseTable(perUserMd, '## bob')
      const row = findRow(table.rows, '2026-04')

      expect(row['Avg Daily Interactions (weekdays)']).toBe('3')
      expect(row['Total Interactions']).toBe('10')
      expect(row['chat']).toBe('8')
      expect(row['code_completions']).toBe('2')
    })

    it('dave: avg daily=1, total=3, chat=0, completions=3', () => {
      // dave weekday interactions: 3 / 4 global weekday days = round(0.75)=1
      const table = parseTable(perUserMd, '## dave')
      const row = findRow(table.rows, '2026-04')

      expect(row['Avg Daily Interactions (weekdays)']).toBe('1')
      expect(row['Total Interactions']).toBe('3')
      expect(row['chat']).toBe('0')
      expect(row['code_completions']).toBe('3')
    })
  })
})
