/**
 * Collapses groups that individually represent less than a given percentage
 * of total usage into an "Others" bucket. Returns the collapsed series and
 * the list of group names that were merged into "Others".
 */

export interface CollapsedResult {
  series: Array<{ name: string; values: number[] }>
  othersMembers: string[]
}

export const collapseSmallGroups = (
  series: Array<{ name: string; values: number[] }>,
  threshold: number = 0.1
): CollapsedResult => {
  const grandTotal = series.reduce(
    (sum, s) => sum + s.values.reduce((a, b) => a + b, 0),
    0
  )

  if (grandTotal === 0) return { series, othersMembers: [] }

  const kept: Array<{ name: string; values: number[] }> = []
  const othersMembers: string[] = []
  let othersValues: number[] | null = null

  for (const s of series) {
    const seriesTotal = s.values.reduce((a, b) => a + b, 0)

    if (seriesTotal / grandTotal < threshold) {
      othersMembers.push(s.name)
      if (!othersValues) {
        othersValues = s.values.map(() => 0)
      }
      for (let i = 0; i < s.values.length; i++) {
        othersValues[i] += s.values[i]
      }
    } else {
      kept.push(s)
    }
  }

  if (othersValues && othersMembers.length > 0) {
    kept.push({ name: 'Others', values: othersValues })
  }

  return { series: kept, othersMembers }
}
