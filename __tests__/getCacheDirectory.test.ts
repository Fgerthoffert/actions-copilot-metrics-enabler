import { jest } from '@jest/globals'
import * as fs from 'fs'
import * as os from 'os'

import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { getCacheDirectory } = await import('../src/utils/getCacheDirectory.js')

describe('getCacheDirectory', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Creates and returns a directory in os.tmpdir()', async () => {
    const folderName = `test-cache-${Date.now()}`
    const result = await getCacheDirectory(folderName)

    expect(result).toContain(folderName)
    expect(fs.existsSync(result)).toBe(true)

    // Cleanup
    fs.rmSync(result, { recursive: true, force: true })
  })

  it('Returns existing directory without error', async () => {
    const folderName = `test-cache-${Date.now()}`
    const result1 = await getCacheDirectory(folderName)
    const result2 = await getCacheDirectory(folderName)

    expect(result1).toBe(result2)

    fs.rmSync(result1, { recursive: true, force: true })
  })
})
