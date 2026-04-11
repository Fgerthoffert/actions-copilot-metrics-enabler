import { jest } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { loadDailyFiles } = await import('../src/utils/loadDailyFiles.js')
const { loadUserDailyFiles } =
  await import('../src/utils/loadUserDailyFiles.js')

describe('loadDailyFiles', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-load-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Returns empty array for non-existent path', () => {
    const result = loadDailyFiles('/nonexistent/path')
    expect(result).toEqual([])
  })

  it('Loads and sorts daily JSON files chronologically', () => {
    fs.writeFileSync(
      path.join(tmpDir, '2026-04-02.json'),
      JSON.stringify({ day: '2026-04-02' })
    )
    fs.writeFileSync(
      path.join(tmpDir, '2026-04-01.json'),
      JSON.stringify({ day: '2026-04-01' })
    )

    const result = loadDailyFiles(tmpDir)
    expect(result.length).toBe(2)
    expect(result[0].day).toBe('2026-04-01')
    expect(result[1].day).toBe('2026-04-02')
  })

  it('Includes multi-part files', () => {
    fs.writeFileSync(
      path.join(tmpDir, '2026-04-01.json'),
      JSON.stringify({ part: 0 })
    )
    fs.writeFileSync(
      path.join(tmpDir, '2026-04-01.json.1'),
      JSON.stringify({ part: 1 })
    )

    const result = loadDailyFiles(tmpDir)
    expect(result.length).toBe(2)
  })

  it('Ignores non-matching files', () => {
    fs.writeFileSync(
      path.join(tmpDir, '2026-04-01.json'),
      JSON.stringify({ day: '2026-04-01' })
    )
    fs.writeFileSync(path.join(tmpDir, 'readme.md'), 'hello')

    const result = loadDailyFiles(tmpDir)
    expect(result.length).toBe(1)
  })
})

describe('loadUserDailyFiles', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-load-user-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  it('Returns empty array for non-existent path', () => {
    const result = loadUserDailyFiles('/nonexistent/path')
    expect(result).toEqual([])
  })

  it('Loads user files from date folders sorted by date', () => {
    const day1 = path.join(tmpDir, '2026-04-01')
    const day2 = path.join(tmpDir, '2026-04-02')
    fs.mkdirSync(day1)
    fs.mkdirSync(day2)

    fs.writeFileSync(
      path.join(day1, '2026-04-01-alice.json'),
      JSON.stringify({ user_login: 'alice', day: '2026-04-01' })
    )
    fs.writeFileSync(
      path.join(day2, '2026-04-02-bob.json'),
      JSON.stringify({ user_login: 'bob', day: '2026-04-02' })
    )

    const result = loadUserDailyFiles(tmpDir)
    expect(result.length).toBe(2)
    expect(result[0].user_login).toBe('alice')
    expect(result[1].user_login).toBe('bob')
  })

  it('Ignores non-date directories', () => {
    fs.mkdirSync(path.join(tmpDir, 'random'))
    fs.writeFileSync(
      path.join(tmpDir, 'random', 'file.json'),
      JSON.stringify({})
    )

    const result = loadUserDailyFiles(tmpDir)
    expect(result).toEqual([])
  })

  it('Filters by include list', () => {
    const day1 = path.join(tmpDir, '2026-04-01')
    fs.mkdirSync(day1)
    fs.writeFileSync(
      path.join(day1, '2026-04-01-alice.json'),
      JSON.stringify({ user_login: 'alice', day: '2026-04-01' })
    )
    fs.writeFileSync(
      path.join(day1, '2026-04-01-bob.json'),
      JSON.stringify({ user_login: 'bob', day: '2026-04-01' })
    )

    const result = loadUserDailyFiles(tmpDir, ['alice'])
    expect(result.length).toBe(1)
    expect(result[0].user_login).toBe('alice')
  })

  it('Filters by exclude list', () => {
    const day1 = path.join(tmpDir, '2026-04-01')
    fs.mkdirSync(day1)
    fs.writeFileSync(
      path.join(day1, '2026-04-01-alice.json'),
      JSON.stringify({ user_login: 'alice', day: '2026-04-01' })
    )
    fs.writeFileSync(
      path.join(day1, '2026-04-01-bob.json'),
      JSON.stringify({ user_login: 'bob', day: '2026-04-01' })
    )

    const result = loadUserDailyFiles(tmpDir, [], ['bob'])
    expect(result.length).toBe(1)
    expect(result[0].user_login).toBe('alice')
  })

  it('Include takes precedence over exclude', () => {
    const day1 = path.join(tmpDir, '2026-04-01')
    fs.mkdirSync(day1)
    fs.writeFileSync(
      path.join(day1, '2026-04-01-alice.json'),
      JSON.stringify({ user_login: 'alice', day: '2026-04-01' })
    )
    fs.writeFileSync(
      path.join(day1, '2026-04-01-bob.json'),
      JSON.stringify({ user_login: 'bob', day: '2026-04-01' })
    )

    // Both filters set, include should take precedence
    const result = loadUserDailyFiles(tmpDir, ['alice'], ['alice'])
    expect(result.length).toBe(1)
    expect(result[0].user_login).toBe('alice')
  })
})
