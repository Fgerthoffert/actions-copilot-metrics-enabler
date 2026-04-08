/**
 * Reusable chart renderer that produces a GitHub-flavored markdown table
 * with inline Unicode bar charts for visual representation of values.
 * The output is wrapped in a collapsible <details> block.
 */

export interface ChartData {
  title: string
  periodLabels: string[]
  series: Array<{
    name: string
    values: number[]
  }>
  othersMembers?: string[]
}

const BAR_CHARS = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']
const MAX_BAR_WIDTH = 8

const renderBar = (value: number, maxValue: number): string => {
  if (maxValue === 0 || value === 0) return ''
  const ratio = value / maxValue
  const totalEighths = Math.round(ratio * MAX_BAR_WIDTH * 8)
  const fullBlocks = Math.floor(totalEighths / 8)
  const remainder = totalEighths % 8

  let bar = '█'.repeat(fullBlocks)
  if (remainder > 0) {
    bar += BAR_CHARS[remainder]
  }
  return bar
}

export const renderChart = (data: ChartData): string => {
  const { title, periodLabels, series, othersMembers } = data
  if (periodLabels.length === 0 || series.length === 0) return ''

  const maxValue = Math.max(...series.flatMap((s) => s.values), 0)
  const headers = ['Period', ...series.map((s) => s.name)]
  const separator = headers.map(() => '---')

  const rows = periodLabels.map((label, i) => {
    const rowTotal = series.reduce((sum, s) => sum + (s.values[i] || 0), 0)
    const cells = series.map((s) => {
      const val = s.values[i] || 0
      if (val === 0) return '0'
      const bar = renderBar(val, maxValue)
      const pct = rowTotal > 0 ? Math.round((val / rowTotal) * 100) : 0
      return `${val} ${bar} (${pct}%)`
    })
    return `| ${label} | ${cells.join(' | ')} |`
  })

  const lines = [
    `<details><summary>${title}</summary>`,
    '',
    `| ${headers.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...rows,
    ''
  ]

  if (othersMembers && othersMembers.length > 0) {
    lines.push(`*Others includes: ${othersMembers.join(', ')}*`)
    lines.push('')
  }

  lines.push('</details>')
  lines.push('')

  return lines.join('\n')
}
