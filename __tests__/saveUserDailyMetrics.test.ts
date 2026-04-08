import { jest } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { saveUserDailyMetrics } =
  await import('../src/utils/saveUserDailyMetrics.js')

describe('saveUserDailyMetrics', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-save-user-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Creates per-user files in date folder', async () => {
    await saveUserDailyMetrics(tmpDir, '2026-04-01', [
      { user_login: 'alice', day: '2026-04-01' },
      { user_login: 'bob', day: '2026-04-01' }
    ])

    const dayDir = path.join(tmpDir, '2026-04-01')
    expect(fs.existsSync(dayDir)).toBe(true)
    expect(fs.existsSync(path.join(dayDir, '2026-04-01-alice.json'))).toBe(true)
    expect(fs.existsSync(path.join(dayDir, '2026-04-01-bob.json'))).toBe(true)
  })

  it('Skips records without user_login', async () => {
    await saveUserDailyMetrics(tmpDir, '2026-04-01', [{ day: '2026-04-01' }])

    const dayDir = path.join(tmpDir, '2026-04-01')
    const files = fs.existsSync(dayDir)
      ? fs.readdirSync(dayDir).filter((f) => f.endsWith('.json'))
      : []
    expect(files.length).toBe(0)
  })
})
