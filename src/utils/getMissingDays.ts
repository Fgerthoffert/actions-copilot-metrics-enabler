import * as core from '@actions/core'

/**
 * Given a set of existing date strings, returns an array of YYYY-MM-DD strings
 * for the last `lookbackDays` days (starting from today, walking backward)
 * that are not already present in the existing set.
 * Today is always included to allow re-downloading when the action runs
 * multiple times in a day.
 */
export const getMissingDays = (
  existingDates: Set<string>,
  lookbackDays: number = 100
): string[] => {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const missingDays: string[] = []

  for (let i = 0; i < lookbackDays; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    if (dateStr === todayStr || !existingDates.has(dateStr)) {
      missingDays.push(dateStr)
    }
  }

  core.info(
    `Identified ${missingDays.length} missing day(s) out of the last ${lookbackDays} days`
  )

  return missingDays
}
