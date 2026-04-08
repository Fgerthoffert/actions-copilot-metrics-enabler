import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import * as core from '@actions/core'

/**
 * Asynchronously retrieves or creates a cache directory within the system's temporary directory.
 *
 * @param folderName - The name of the folder to be used as the cache directory.
 * @returns A promise that resolves to the path of the cache directory.
 *
 * @remarks
 * If the specified folder does not exist, it will be created recursively.
 * Logs the creation of the cache directory using `core.info`.
 *
 * @throws Will throw an error if the directory cannot be created.
 */
export const getCacheDirectory = async (
  folderName: string
): Promise<string> => {
  const dataCacheDir = path.join(os.tmpdir(), folderName)
  if (!fs.existsSync(dataCacheDir)) {
    fs.mkdirSync(dataCacheDir, { recursive: true })
  }
  core.info(`Cache directory created at: ${dataCacheDir}`)
  return dataCacheDir
}

export default getCacheDirectory
