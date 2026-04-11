/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

const getConnectedUser = jest.fn<() => Promise<string>>()
const fetchMissingUsersMetrics = jest.fn<() => Promise<void>>()
const getCacheDirectory = jest.fn<() => Promise<string>>()
const generateReports = jest.fn<() => Promise<void>>()

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/utils/github/getConnectedUser.js', () => ({
  getConnectedUser
}))
jest.unstable_mockModule('../src/utils/fetchMissingUsersMetrics.js', () => ({
  fetchMissingUsersMetrics
}))
jest.unstable_mockModule('../src/utils/getCacheDirectory.js', () => ({
  getCacheDirectory
}))
jest.unstable_mockModule('../src/utils/report/generateReports.js', () => ({
  generateReports
}))

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'fake-token'
      if (name === 'github_org') return 'my-org'
      if (name === 'path') return '/tmp/metrics'
      return ''
    })

    getConnectedUser.mockResolvedValue('test-user')
    fetchMissingUsersMetrics.mockResolvedValue(undefined)
    generateReports.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Sets the path output', async () => {
    await run()

    expect(core.setOutput).toHaveBeenNthCalledWith(1, 'path', '/tmp/metrics')
  })

  it('Fetches user metrics', async () => {
    await run()

    expect(fetchMissingUsersMetrics).toHaveBeenCalledWith({
      githubToken: 'fake-token',
      org: 'my-org',
      storePath: '/tmp/metrics/source/users',
      lookbackDays: 100
    })
  })

  it('Uses cache directory when no path is provided', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'fake-token'
      if (name === 'github_org') return 'my-org'
      if (name === 'path') return ''
      return ''
    })

    getCacheDirectory.mockResolvedValue('/tmp/copilot-metrics-cache')

    await run()

    expect(getCacheDirectory).toHaveBeenCalledWith(
      'copilot-metrics-cache-my-org'
    )
    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      'path',
      '/tmp/copilot-metrics-cache'
    )
  })

  it('Calls generateReports with filters when summary_report=true', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'fake-token'
      if (name === 'github_org') return 'my-org'
      if (name === 'path') return '/tmp/metrics'
      if (name === 'summary_report') return 'true'
      if (name === 'include_users') return 'alice,bob'
      if (name === 'exclude_users') return ''
      return ''
    })

    await run()

    expect(generateReports).toHaveBeenCalledWith(
      '/tmp/metrics',
      '/tmp/metrics',
      ['alice', 'bob'],
      []
    )
  })

  it('Does not call generateReports when summary_report is not true', async () => {
    await run()

    expect(generateReports).not.toHaveBeenCalled()
  })

  it('Uses report_path for reports when provided', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'fake-token'
      if (name === 'github_org') return 'my-org'
      if (name === 'path') return '/tmp/metrics'
      if (name === 'report_path') return '/tmp/reports'
      if (name === 'summary_report') return 'true'
      return ''
    })

    await run()

    expect(generateReports).toHaveBeenCalledWith(
      '/tmp/metrics',
      '/tmp/reports',
      [],
      []
    )
  })

  it('Sets a failed status on error', async () => {
    getConnectedUser.mockRejectedValue(new Error('Bad credentials'))

    await run()

    expect(core.setFailed).toHaveBeenNthCalledWith(1, 'Bad credentials')
  })
})
