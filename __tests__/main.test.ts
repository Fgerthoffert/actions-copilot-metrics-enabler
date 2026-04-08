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
const fetchMissingOrganizationMetrics = jest.fn<() => Promise<void>>()
const fetchMissingUsersMetrics = jest.fn<() => Promise<void>>()
const getCacheDirectory = jest.fn<() => Promise<string>>()
const generateReports = jest.fn<() => Promise<void>>()

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/utils/github/getConnectedUser.js', () => ({
  getConnectedUser
}))
jest.unstable_mockModule(
  '../src/utils/fetchMissingOrganizationMetrics.js',
  () => ({
    fetchMissingOrganizationMetrics
  })
)
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
      if (name === 'reports') return 'all'
      return ''
    })

    getConnectedUser.mockResolvedValue('test-user')
    fetchMissingOrganizationMetrics.mockResolvedValue(undefined)
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

  it('Calls both fetch functions with subfolders when metrics=all', async () => {
    await run()

    expect(fetchMissingOrganizationMetrics).toHaveBeenCalledWith({
      githubToken: 'fake-token',
      org: 'my-org',
      storePath: '/tmp/metrics/source/organization',
      lookbackDays: 100
    })
    expect(fetchMissingUsersMetrics).toHaveBeenCalledWith({
      githubToken: 'fake-token',
      org: 'my-org',
      storePath: '/tmp/metrics/source/users',
      lookbackDays: 100
    })
  })

  it('Only calls fetchMissingOrganizationMetrics when metrics=organization', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'fake-token'
      if (name === 'github_org') return 'my-org'
      if (name === 'path') return '/tmp/metrics'
      if (name === 'reports') return 'organization'
      return ''
    })

    await run()

    expect(fetchMissingOrganizationMetrics).toHaveBeenCalledTimes(1)
    expect(fetchMissingUsersMetrics).not.toHaveBeenCalled()
  })

  it('Only calls fetchMissingUsersMetrics when metrics=users', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'fake-token'
      if (name === 'github_org') return 'my-org'
      if (name === 'path') return '/tmp/metrics'
      if (name === 'reports') return 'users'
      return ''
    })

    await run()

    expect(fetchMissingUsersMetrics).toHaveBeenCalledTimes(1)
    expect(fetchMissingOrganizationMetrics).not.toHaveBeenCalled()
  })

  it('Uses cache directory when no path is provided', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'fake-token'
      if (name === 'github_org') return 'my-org'
      if (name === 'path') return ''
      if (name === 'reports') return 'all'
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

  it('Sets a failed status on error', async () => {
    getConnectedUser.mockRejectedValue(new Error('Bad credentials'))

    await run()

    expect(core.setFailed).toHaveBeenNthCalledWith(1, 'Bad credentials')
  })
})
