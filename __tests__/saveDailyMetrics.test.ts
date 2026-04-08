import { jest } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { saveDailyMetrics } = await import('../src/utils/saveDailyMetrics.js')

describe('saveDailyMetrics', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-save-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Saves single item as YYYY-MM-DD.json', async () => {
    await saveDailyMetrics(tmpDir, '2026-04-01', [{ day: '2026-04-01' }])

    const filePath = path.join(tmpDir, '2026-04-01.json')
    expect(fs.existsSync(filePath)).toBe(true)
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    expect(content.day).toBe('2026-04-01')
  })

  it('Saves multiple items with suffixes', async () => {
    await saveDailyMetrics(tmpDir, '2026-04-01', [
      { part: 0 },
      { part: 1 },
      { part: 2 }
    ])

    expect(fs.existsSync(path.join(tmpDir, '2026-04-01.json'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, '2026-04-01.json.1'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, '2026-04-01.json.2'))).toBe(true)
  })

  it('Creates directory if it does not exist', async () => {
    const nested = path.join(tmpDir, 'a', 'b')
    await saveDailyMetrics(nested, '2026-04-01', [{ day: '2026-04-01' }])
    expect(fs.existsSync(path.join(nested, '2026-04-01.json'))).toBe(true)
  })
})
