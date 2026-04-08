import { jest } from '@jest/globals'

import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { getMissingDays } = await import('../src/utils/getMissingDays.js')

describe('getMissingDays', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Returns all days when no existing dates', () => {
    const result = getMissingDays(new Set(), 5)
    expect(result.length).toBe(5)
    // All dates should be YYYY-MM-DD format
    for (const d of result) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('Always includes today even if it exists', () => {
    const today = new Date().toISOString().split('T')[0]
    const result = getMissingDays(new Set([today]), 3)
    expect(result).toContain(today)
  })

  it('Skips non-today dates that already exist', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const result = getMissingDays(new Set([yesterdayStr]), 3)
    expect(result).not.toContain(yesterdayStr)
  })

  it('Defaults to 100 lookback days', () => {
    const result = getMissingDays(new Set())
    expect(result.length).toBe(100)
  })
})
