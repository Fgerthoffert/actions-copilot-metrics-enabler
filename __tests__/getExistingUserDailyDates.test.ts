import { jest } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { getExistingUserDailyDates } =
  await import('../src/utils/getExistingUserDailyDates.js')

describe('getExistingUserDailyDates', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-user-dates-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Returns empty set for non-existent path', async () => {
    const result = await getExistingUserDailyDates('/nonexistent/path')
    expect(result.size).toBe(0)
  })

  it('Returns date strings for date-named directories', async () => {
    fs.mkdirSync(path.join(tmpDir, '2026-04-01'))
    fs.mkdirSync(path.join(tmpDir, '2026-04-02'))
    fs.writeFileSync(path.join(tmpDir, 'not-a-dir.txt'), 'ignore')

    const result = await getExistingUserDailyDates(tmpDir)
    expect(result.size).toBe(2)
    expect(result.has('2026-04-01')).toBe(true)
    expect(result.has('2026-04-02')).toBe(true)
  })

  it('Ignores non-date directories', async () => {
    fs.mkdirSync(path.join(tmpDir, 'random-dir'))
    fs.mkdirSync(path.join(tmpDir, '2026-04-01'))

    const result = await getExistingUserDailyDates(tmpDir)
    expect(result.size).toBe(1)
  })
})
