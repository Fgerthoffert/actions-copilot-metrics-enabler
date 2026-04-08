import { jest } from '@jest/globals'

import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { downloadReportContent } = await import(
  '../src/utils/downloadReportContent.js'
)
const { downloadNdjsonContent } = await import(
  '../src/utils/downloadNdjsonContent.js'
)

describe('downloadReportContent', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.resetAllMocks()
  })

  it('Downloads and parses JSON from each link', async () => {
    globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ day: '2026-04-01', total: 100 })
    } as Response)

    const result = await downloadReportContent([
      'https://example.com/report1'
    ])
    expect(result.length).toBe(1)
    expect(result[0].day).toBe('2026-04-01')
  })

  it('Throws on non-OK response', async () => {
    globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    } as Response)

    await expect(
      downloadReportContent(['https://example.com/bad'])
    ).rejects.toThrow('Failed to download')
  })
})

describe('downloadNdjsonContent', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.resetAllMocks()
  })

  it('Parses NDJSON lines from each link', async () => {
    const ndjson =
      '{"user_login":"alice","day":"2026-04-01"}\n{"user_login":"bob","day":"2026-04-01"}\n'
    globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      text: async () => ndjson
    } as Response)

    const result = await downloadNdjsonContent([
      'https://example.com/users'
    ])
    expect(result.length).toBe(2)
    expect(result[0].user_login).toBe('alice')
    expect(result[1].user_login).toBe('bob')
  })

  it('Throws on non-OK response', async () => {
    globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    } as Response)

    await expect(
      downloadNdjsonContent(['https://example.com/bad'])
    ).rejects.toThrow('Failed to download')
  })
})
