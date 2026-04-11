import { jest } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { generateUserPrompts } =
  await import('../src/utils/report/generateUserPrompts.js')

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

describe('generateUserPrompts', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-prompts-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Returns empty array when no data', () => {
    const result = generateUserPrompts(tmpDir)
    expect(result).toEqual([])
  })

  it('Generates one prompt file per user', () => {
    // 2026-04-01 is Tuesday (weekday)
    writeUserDay(tmpDir, '2026-04-01', 'alice', {
      user_initiated_interaction_count: 50,
      code_generation_activity_count: 30,
      code_acceptance_activity_count: 20,
      loc_suggested_to_add_sum: 100,
      loc_added_sum: 80,
      used_agent: true,
      used_chat: true,
      totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 50 }],
      totals_by_feature: [
        {
          feature: 'chat_panel_agent_mode',
          user_initiated_interaction_count: 30
        },
        { feature: 'code_completion', user_initiated_interaction_count: 20 }
      ],
      totals_by_model_feature: [
        {
          model: 'gpt-4o',
          feature: 'chat',
          user_initiated_interaction_count: 50
        }
      ]
    })
    writeUserDay(tmpDir, '2026-04-01', 'bob', {
      user_initiated_interaction_count: 10,
      code_generation_activity_count: 5,
      code_acceptance_activity_count: 3,
      loc_suggested_to_add_sum: 20,
      loc_added_sum: 15,
      used_agent: false,
      used_chat: true,
      totals_by_ide: [
        { ide: 'jetbrains', user_initiated_interaction_count: 10 }
      ],
      totals_by_feature: [
        { feature: 'code_completion', user_initiated_interaction_count: 10 }
      ],
      totals_by_model_feature: []
    })

    const result = generateUserPrompts(tmpDir)
    expect(result.length).toBe(3)

    const aliceFile = result.find((r) => r.filename === 'prompts/alice.md')
    const bobFile = result.find((r) => r.filename === 'prompts/bob.md')
    const teamFile = result.find((r) => r.filename === 'prompts/team.md')
    expect(aliceFile).toBeDefined()
    expect(bobFile).toBeDefined()
    expect(teamFile).toBeDefined()
  })

  it('Includes user activity data in the prompt', () => {
    writeUserDay(tmpDir, '2026-04-01', 'alice', {
      user_initiated_interaction_count: 50,
      code_generation_activity_count: 30,
      code_acceptance_activity_count: 20,
      loc_suggested_to_add_sum: 100,
      loc_added_sum: 80,
      used_agent: true,
      used_chat: true,
      totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 50 }],
      totals_by_feature: [
        {
          feature: 'chat_panel_agent_mode',
          user_initiated_interaction_count: 30
        },
        { feature: 'code_completion', user_initiated_interaction_count: 20 }
      ],
      totals_by_model_feature: []
    })

    const result = generateUserPrompts(tmpDir)
    const md = result[0].content

    expect(md).toContain('# Enablement Prompt — alice')
    expect(md).toContain('Total interactions (prompts) | 50')
    expect(md).toContain('Days active | 1')
    expect(md).toContain('Code generation events | 30')
    expect(md).toContain('Lines of code added | 80')
    expect(md).toContain('chat_panel_agent_mode')
    expect(md).toContain('vscode')
  })

  it('Includes team context and champions', () => {
    writeUserDay(tmpDir, '2026-04-01', 'alice', {
      user_initiated_interaction_count: 100,
      code_generation_activity_count: 0,
      code_acceptance_activity_count: 0,
      totals_by_feature: [],
      totals_by_ide: [],
      totals_by_model_feature: []
    })
    writeUserDay(tmpDir, '2026-04-01', 'bob', {
      user_initiated_interaction_count: 20,
      code_generation_activity_count: 0,
      code_acceptance_activity_count: 0,
      totals_by_feature: [],
      totals_by_ide: [],
      totals_by_model_feature: []
    })

    const result = generateUserPrompts(tmpDir)
    const bobPrompt = result.find((r) => r.filename === 'prompts/bob.md')!
    const md = bobPrompt.content

    expect(md).toContain('## Team Context')
    expect(md).toContain('Team size | 2 users')
    expect(md).toContain('Champions')
    expect(md).toContain('alice')
  })

  it('Lists features not yet tried by the user', () => {
    writeUserDay(tmpDir, '2026-04-01', 'alice', {
      user_initiated_interaction_count: 50,
      code_generation_activity_count: 0,
      code_acceptance_activity_count: 0,
      totals_by_feature: [
        {
          feature: 'chat_panel_agent_mode',
          user_initiated_interaction_count: 30
        },
        { feature: 'code_completion', user_initiated_interaction_count: 20 }
      ],
      totals_by_ide: [],
      totals_by_model_feature: []
    })
    writeUserDay(tmpDir, '2026-04-01', 'bob', {
      user_initiated_interaction_count: 10,
      code_generation_activity_count: 0,
      code_acceptance_activity_count: 0,
      totals_by_feature: [
        { feature: 'code_completion', user_initiated_interaction_count: 10 }
      ],
      totals_by_ide: [],
      totals_by_model_feature: []
    })

    const result = generateUserPrompts(tmpDir)
    const bobPrompt = result.find((r) => r.filename === 'prompts/bob.md')!

    expect(bobPrompt.content).toContain('Features Not Yet Tried')
    expect(bobPrompt.content).toContain('chat_panel_agent_mode')
  })

  it('Respects include_users filter', () => {
    writeUserDay(tmpDir, '2026-04-01', 'alice', {
      user_initiated_interaction_count: 50,
      code_generation_activity_count: 0,
      code_acceptance_activity_count: 0,
      totals_by_feature: [],
      totals_by_ide: [],
      totals_by_model_feature: []
    })
    writeUserDay(tmpDir, '2026-04-01', 'bob', {
      user_initiated_interaction_count: 10,
      code_generation_activity_count: 0,
      code_acceptance_activity_count: 0,
      totals_by_feature: [],
      totals_by_ide: [],
      totals_by_model_feature: []
    })

    const result = generateUserPrompts(tmpDir, ['alice'], [])
    expect(result.length).toBe(2)
    expect(result.find((r) => r.filename === 'prompts/alice.md')).toBeDefined()
    expect(result.find((r) => r.filename === 'prompts/team.md')).toBeDefined()
  })

  it('Only counts recent working days', () => {
    // 2026-04-05 is Saturday (should be excluded)
    // 2026-04-07 is Monday (should be included)
    writeUserDay(tmpDir, '2026-04-05', 'alice', {
      user_initiated_interaction_count: 100,
      code_generation_activity_count: 0,
      code_acceptance_activity_count: 0,
      totals_by_feature: [],
      totals_by_ide: [],
      totals_by_model_feature: []
    })
    writeUserDay(tmpDir, '2026-04-07', 'alice', {
      user_initiated_interaction_count: 20,
      code_generation_activity_count: 0,
      code_acceptance_activity_count: 0,
      totals_by_feature: [],
      totals_by_ide: [],
      totals_by_model_feature: []
    })

    const result = generateUserPrompts(tmpDir)
    const alicePrompt = result.find((r) => r.filename === 'prompts/alice.md')!
    const md = alicePrompt.content

    // Only Monday data should be counted
    expect(md).toContain('Total interactions (prompts) | 20')
    expect(md).toContain('Days active | 1')
  })

  it('Generates a team prompt with overview data', () => {
    writeUserDay(tmpDir, '2026-04-01', 'alice', {
      user_initiated_interaction_count: 80,
      code_generation_activity_count: 0,
      code_acceptance_activity_count: 0,
      totals_by_feature: [
        {
          feature: 'chat_panel_agent_mode',
          user_initiated_interaction_count: 50
        },
        { feature: 'code_completion', user_initiated_interaction_count: 30 }
      ],
      totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 80 }],
      totals_by_model_feature: []
    })
    writeUserDay(tmpDir, '2026-04-01', 'bob', {
      user_initiated_interaction_count: 20,
      code_generation_activity_count: 0,
      code_acceptance_activity_count: 0,
      totals_by_feature: [
        { feature: 'code_completion', user_initiated_interaction_count: 20 }
      ],
      totals_by_ide: [
        { ide: 'jetbrains', user_initiated_interaction_count: 20 }
      ],
      totals_by_model_feature: []
    })

    const result = generateUserPrompts(tmpDir)
    const teamPrompt = result.find((r) => r.filename === 'prompts/team.md')!
    expect(teamPrompt).toBeDefined()
    const md = teamPrompt.content

    expect(md).toContain('# Enablement Prompt — Team Overview')
    expect(md).toContain('## Team Summary')
    expect(md).toContain('Team size | 2')

    // Feature adoption table
    expect(md).toContain('### Feature Adoption')
    expect(md).toContain('code_completion')
    expect(md).toContain('chat_panel_agent_mode')

    // IDE adoption table
    expect(md).toContain('### IDE Adoption')
    expect(md).toContain('vscode')
    expect(md).toContain('jetbrains')

    // Per-user breakdown
    expect(md).toContain('### Per-User Breakdown')
    expect(md).toContain('alice')
    expect(md).toContain('bob')

    // Champions
    expect(md).toContain('### Champions')

    // Users below median
    expect(md).toContain('### Users Below Median Activity')
    expect(md).toContain('bob')

    // Feature gaps
    expect(md).toContain('### Feature Gaps by User')
    expect(md).toContain('chat_panel_agent_mode')
  })
})
