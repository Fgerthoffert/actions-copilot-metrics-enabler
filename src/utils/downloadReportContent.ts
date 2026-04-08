import * as core from '@actions/core'

/**
 * Downloads the actual report content from the download links returned by the
 * Copilot metrics API. Returns an array of parsed JSON objects, one per link.
 */
export const downloadReportContent = async (
  downloadLinks: string[]
): Promise<Record<string, unknown>[]> => {
  const results: Record<string, unknown>[] = []

  for (const [index, url] of downloadLinks.entries()) {
    core.info(
      `Downloading report content (${index + 1}/${downloadLinks.length})`
    )

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(
        `Failed to download report from link ${index + 1}: ${response.status} ${response.statusText}`
      )
    }

    const data = (await response.json()) as Record<string, unknown>
    results.push(data)
  }

  return results
}
