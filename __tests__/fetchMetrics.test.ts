import { jest } from '@jest/globals'

import * as core from '../__fixtures__/core.js'

const getExistingDailyFiles = jest
  .fn<() => Promise<Set<string>>>()
  .mockResolvedValue(new Set())
const getMissingDays = jest.fn<() => string[]>().mockReturnValue([])
const getOrganizationMetrics = jest
  .fn<() => Promise<Record<string, unknown>>>()
  .mockResolvedValue({})
const downloadReportContent = jest
  .fn<() => Promise<Record<string, unknown>[]>>()
  .mockResolvedValue([])
const saveDailyMetrics = jest.fn<() => Promise<void>>()
const getExistingUserDailyDates = jest
  .fn<() => Promise<Set<string>>>()
  .mockResolvedValue(new Set())
const getUsersMetrics = jest
  .fn<() => Promise<Record<string, unknown>>>()
  .mockResolvedValue({})
const downloadNdjsonContent = jest
  .fn<() => Promise<Record<string, unknown>[]>>()
  .mockResolvedValue([])
const saveUserDailyMetrics = jest.fn<() => Promise<void>>()

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/utils/getExistingDailyFiles.js', () => ({
  getExistingDailyFiles
}))
jest.unstable_mockModule('../src/utils/getMissingDays.js', () => ({
  getMissingDays
}))
jest.unstable_mockModule(
  '../src/utils/github/getOrganizationMetrics.js',
  () => ({ getOrganizationMetrics })
)
jest.unstable_mockModule('../src/utils/downloadReportContent.js', () => ({
  downloadReportContent
}))
jest.unstable_mockModule('../src/utils/saveDailyMetrics.js', () => ({
  saveDailyMetrics
}))
jest.unstable_mockModule('../src/utils/getExistingUserDailyDates.js', () => ({
  getExistingUserDailyDates
}))
jest.unstable_mockModule('../src/utils/github/getUsersMetrics.js', () => ({
  getUsersMetrics
}))
jest.unstable_mockModule('../src/utils/downloadNdjsonContent.js', () => ({
  downloadNdjsonContent
}))
jest.unstable_mockModule('../src/utils/saveUserDailyMetrics.js', () => ({
  saveUserDailyMetrics
}))

const { fetchMissingOrganizationMetrics } =
  await import('../src/utils/fetchMissingOrganizationMetrics.js')
const { fetchMissingUsersMetrics } =
  await import('../src/utils/fetchMissingUsersMetrics.js')

describe('fetchMissingOrganizationMetrics', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Does nothing when no days are missing', async () => {
    getMissingDays.mockReturnValue([])

    await fetchMissingOrganizationMetrics({
      githubToken: 'token',
      org: 'my-org',
      storePath: '/tmp/test',
      lookbackDays: 28
    })

    expect(getOrganizationMetrics).not.toHaveBeenCalled()
  })

  it('Fetches, downloads, and saves for each missing day', async () => {
    getMissingDays.mockReturnValue(['2026-04-01', '2026-04-02'])
    getOrganizationMetrics.mockResolvedValue({
      download_links: ['https://example.com/d1']
    })
    downloadReportContent.mockResolvedValue([{ day: '2026-04-01' }])
    saveDailyMetrics.mockResolvedValue(undefined)

    await fetchMissingOrganizationMetrics({
      githubToken: 'token',
      org: 'my-org',
      storePath: '/tmp/test',
      lookbackDays: 28
    })

    expect(getOrganizationMetrics).toHaveBeenCalledTimes(2)
    expect(downloadReportContent).toHaveBeenCalledTimes(2)
    expect(saveDailyMetrics).toHaveBeenCalledTimes(2)
  })

  it('Skips days with no download links', async () => {
    getMissingDays.mockReturnValue(['2026-04-01'])
    getOrganizationMetrics.mockResolvedValue({
      download_links: []
    })

    await fetchMissingOrganizationMetrics({
      githubToken: 'token',
      org: 'my-org',
      storePath: '/tmp/test',
      lookbackDays: 28
    })

    expect(downloadReportContent).not.toHaveBeenCalled()
    expect(core.warning).toHaveBeenCalled()
  })

  it('Warns on error and continues', async () => {
    getMissingDays.mockReturnValue(['2026-04-01', '2026-04-02'])
    getOrganizationMetrics
      .mockRejectedValueOnce(new Error('API failure'))
      .mockResolvedValueOnce({
        download_links: ['https://example.com/d2']
      })
    downloadReportContent.mockResolvedValue([{ day: '2026-04-02' }])
    saveDailyMetrics.mockResolvedValue(undefined)

    await fetchMissingOrganizationMetrics({
      githubToken: 'token',
      org: 'my-org',
      storePath: '/tmp/test',
      lookbackDays: 28
    })

    expect(core.warning).toHaveBeenCalledTimes(1)
    expect(saveDailyMetrics).toHaveBeenCalledTimes(1)
  })
})

describe('fetchMissingUsersMetrics', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Does nothing when no days are missing', async () => {
    getMissingDays.mockReturnValue([])

    await fetchMissingUsersMetrics({
      githubToken: 'token',
      org: 'my-org',
      storePath: '/tmp/test',
      lookbackDays: 28
    })

    expect(getUsersMetrics).not.toHaveBeenCalled()
  })

  it('Fetches, downloads NDJSON, and saves per-user for each day', async () => {
    getMissingDays.mockReturnValue(['2026-04-01'])
    getUsersMetrics.mockResolvedValue({
      download_links: ['https://example.com/u1']
    })
    downloadNdjsonContent.mockResolvedValue([
      { user_login: 'alice', day: '2026-04-01' }
    ])
    saveUserDailyMetrics.mockResolvedValue(undefined)

    await fetchMissingUsersMetrics({
      githubToken: 'token',
      org: 'my-org',
      storePath: '/tmp/test',
      lookbackDays: 28
    })

    expect(getUsersMetrics).toHaveBeenCalledTimes(1)
    expect(downloadNdjsonContent).toHaveBeenCalledTimes(1)
    expect(saveUserDailyMetrics).toHaveBeenCalledTimes(1)
  })

  it('Skips days with no download links', async () => {
    getMissingDays.mockReturnValue(['2026-04-01'])
    getUsersMetrics.mockResolvedValue({
      download_links: []
    })

    await fetchMissingUsersMetrics({
      githubToken: 'token',
      org: 'my-org',
      storePath: '/tmp/test',
      lookbackDays: 28
    })

    expect(downloadNdjsonContent).not.toHaveBeenCalled()
  })

  it('Warns on error and continues', async () => {
    getMissingDays.mockReturnValue(['2026-04-01', '2026-04-02'])
    getUsersMetrics
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({
        download_links: ['https://example.com/u2']
      })
    downloadNdjsonContent.mockResolvedValue([
      { user_login: 'bob', day: '2026-04-02' }
    ])
    saveUserDailyMetrics.mockResolvedValue(undefined)

    await fetchMissingUsersMetrics({
      githubToken: 'token',
      org: 'my-org',
      storePath: '/tmp/test',
      lookbackDays: 28
    })

    expect(core.warning).toHaveBeenCalledTimes(1)
    expect(saveUserDailyMetrics).toHaveBeenCalledTimes(1)
  })
})
