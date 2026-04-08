import { jest } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { getExistingDailyFiles } =
  await import('../src/utils/getExistingDailyFiles.js')

describe('getExistingDailyFiles', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-existing-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Returns empty set for non-existent path', async () => {
    const result = await getExistingDailyFiles('/nonexistent/path')
    expect(result.size).toBe(0)
  })

  it('Returns empty set for directory with no matching files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'readme.md'), 'hello')
    const result = await getExistingDailyFiles(tmpDir)
    expect(result.size).toBe(0)
  })

  it('Returns date strings for matching JSON files', async () => {
    fs.writeFileSync(path.join(tmpDir, '2026-04-01.json'), '{}')
    fs.writeFileSync(path.join(tmpDir, '2026-04-02.json'), '{}')
    fs.writeFileSync(path.join(tmpDir, 'other.txt'), 'ignore')

    const result = await getExistingDailyFiles(tmpDir)
    expect(result.size).toBe(2)
    expect(result.has('2026-04-01')).toBe(true)
    expect(result.has('2026-04-02')).toBe(true)
  })
})
