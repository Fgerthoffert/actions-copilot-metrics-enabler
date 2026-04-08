import * as core from '@actions/core'

/**
 * Downloads NDJSON (newline-delimited JSON) content from the download links
 * returned by the Copilot users metrics API. Each line in the response is a
 * separate JSON object representing one user. Returns a flat array of all
 * parsed user records across all links.
 */
export const downloadNdjsonContent = async (
  downloadLinks: string[]
): Promise<Record<string, unknown>[]> => {
  const results: Record<string, unknown>[] = []

  for (const [index, url] of downloadLinks.entries()) {
    core.info(
      `Downloading NDJSON report content (${index + 1}/${downloadLinks.length})`
    )

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(
        `Failed to download report from link ${index + 1}: ${response.status} ${response.statusText}`
      )
    }

    const text = await response.text()
    const lines = text.split('\n').filter((line) => line.trim().length > 0)

    for (const line of lines) {
      results.push(JSON.parse(line) as Record<string, unknown>)
    }
  }

  core.info(`Parsed ${results.length} user record(s) from NDJSON`)
  return results
}
