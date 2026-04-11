/**
 * Generates per-user AI prompt files for enablement coaching.
 * Each file contains a structured prompt with usage data that can be
 * fed to an AI to craft a personalized enablement message.
 */

import * as core from '@actions/core'

import { loadUserDailyFiles } from '../loadUserDailyFiles.js'
import type { ReportFile } from './writeReportFiles.js'

interface FeatureUsage {
  feature: string
  interactions: number
  days_used: number
}

interface IdeUsage {
  ide: string
  interactions: number
  days_used: number
}

interface ModelUsage {
  model: string
  interactions: number
  days_used: number
}

interface UserProfile {
  login: string
  days_active: number
  total_interactions: number
  avg_interactions_per_day: number
  total_code_generations: number
  total_code_acceptances: number
  loc_suggested_to_add: number
  loc_added: number
  used_agent_days: number
  used_chat_days: number
  features: FeatureUsage[]
  ides: IdeUsage[]
  models: ModelUsage[]
}

interface TeamStats {
  total_users: number
  working_days: number
  avg_interactions_per_user: number
  median_interactions_per_user: number
  avg_days_active: number
  champions: { login: string; interactions: number }[]
  all_features: string[]
}

const isWeekday = (dateStr: string): boolean => {
  const d = new Date(dateStr + 'T00:00:00Z')
  const dow = d.getUTCDay()
  return dow >= 1 && dow <= 5
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

const buildUserProfile = (
  login: string,
  files: Record<string, unknown>[],
  numDays: number
): UserProfile => {
  let totalInteractions = 0
  let totalCodeGen = 0
  let totalCodeAccept = 0
  let locSuggestedAdd = 0
  let locAdded = 0
  let usedAgentDays = 0
  let usedChatDays = 0

  const featureMap = new Map<
    string,
    { interactions: number; days: Set<string> }
  >()
  const ideMap = new Map<string, { interactions: number; days: Set<string> }>()
  const modelMap = new Map<
    string,
    { interactions: number; days: Set<string> }
  >()

  for (const f of files) {
    const day = f.day as string
    totalInteractions += (f.user_initiated_interaction_count as number) || 0
    totalCodeGen += (f.code_generation_activity_count as number) || 0
    totalCodeAccept += (f.code_acceptance_activity_count as number) || 0
    locSuggestedAdd += (f.loc_suggested_to_add_sum as number) || 0
    locAdded += (f.loc_added_sum as number) || 0
    if (f.used_agent) usedAgentDays++
    if (f.used_chat) usedChatDays++

    const features = (f.totals_by_feature as Record<string, unknown>[]) || []
    for (const feat of features) {
      const name = feat.feature as string
      const count = (feat.user_initiated_interaction_count as number) || 0
      const existing = featureMap.get(name) || {
        interactions: 0,
        days: new Set<string>()
      }
      existing.interactions += count
      existing.days.add(day)
      featureMap.set(name, existing)
    }

    const ides = (f.totals_by_ide as Record<string, unknown>[]) || []
    for (const ide of ides) {
      const name = ide.ide as string
      const count = (ide.user_initiated_interaction_count as number) || 0
      const existing = ideMap.get(name) || {
        interactions: 0,
        days: new Set<string>()
      }
      existing.interactions += count
      existing.days.add(day)
      ideMap.set(name, existing)
    }

    const models =
      (f.totals_by_model_feature as Record<string, unknown>[]) || []
    for (const m of models) {
      const name = m.model as string
      const count = (m.user_initiated_interaction_count as number) || 0
      const existing = modelMap.get(name) || {
        interactions: 0,
        days: new Set<string>()
      }
      existing.interactions += count
      existing.days.add(day)
      modelMap.set(name, existing)
    }
  }

  const toSorted = <T extends { interactions: number }>(
    map: Map<string, { interactions: number; days: Set<string> }>,
    mapFn: (
      name: string,
      data: { interactions: number; days: Set<string> }
    ) => T
  ): T[] =>
    [...map.entries()]
      .map(([name, data]) => mapFn(name, data))
      .sort((a, b) => b.interactions - a.interactions)

  return {
    login,
    days_active: files.length,
    total_interactions: totalInteractions,
    avg_interactions_per_day:
      numDays > 0 ? parseFloat((totalInteractions / numDays).toFixed(1)) : 0,
    total_code_generations: totalCodeGen,
    total_code_acceptances: totalCodeAccept,
    loc_suggested_to_add: locSuggestedAdd,
    loc_added: locAdded,
    used_agent_days: usedAgentDays,
    used_chat_days: usedChatDays,
    features: toSorted(featureMap, (feature, d) => ({
      feature,
      interactions: d.interactions,
      days_used: d.days.size
    })),
    ides: toSorted(ideMap, (ide, d) => ({
      ide,
      interactions: d.interactions,
      days_used: d.days.size
    })),
    models: toSorted(modelMap, (model, d) => ({
      model,
      interactions: d.interactions,
      days_used: d.days.size
    }))
  }
}

const buildPromptMarkdown = (user: UserProfile, team: TeamStats): string => {
  let md = `# Enablement Prompt — ${user.login}\n\n`
  md += `[← Back to Index](../README.md)\n\n`
  md += `> This file contains a structured AI prompt with usage data for **${user.login}**.\n`
  md += `> Feed this entire document to an AI assistant to generate a personalized enablement message.\n\n`
  md += `---\n\n`

  md += `## Prompt\n\n`
  md += `You are a developer enablement coach helping teams adopt GitHub Copilot effectively. `
  md += `Your tone is encouraging, educational, and constructive — never judgmental or mandating. `
  md += `Focus on practical tips, quick wins, and celebrating progress.\n\n`
  md += `Using the data below, craft a personalized message for **${user.login}** that:\n\n`
  md += `1. Acknowledges their current usage and any strengths\n`
  md += `2. Gently highlights opportunities to grow (unused features, low-activity patterns)\n`
  md += `3. Provides 2-3 specific, actionable suggestions tailored to their profile\n`
  md += `4. Suggests team champions they could pair with or learn from\n`
  md += `5. Keeps the message concise (under 300 words) and human\n\n`

  md += `---\n\n`

  // User stats
  md += `## User Data: ${user.login}\n\n`
  md += `### Activity Summary (last ${team.working_days} working days)\n\n`
  md += `| Metric | Value |\n`
  md += `| --- | --- |\n`
  md += `| Days active | ${user.days_active} / ${team.working_days} |\n`
  md += `| Total interactions (prompts) | ${user.total_interactions} |\n`
  md += `| Avg interactions / working day | ${user.avg_interactions_per_day} |\n`
  md += `| Code generation events | ${user.total_code_generations} |\n`
  md += `| Code acceptances | ${user.total_code_acceptances} |\n`
  md += `| Lines of code suggested (additions) | ${user.loc_suggested_to_add} |\n`
  md += `| Lines of code added | ${user.loc_added} |\n`
  md += `| Days using agent mode | ${user.used_agent_days} |\n`
  md += `| Days using chat | ${user.used_chat_days} |\n`
  md += '\n'

  // Features
  md += `### Features Used\n\n`
  if (user.features.length > 0) {
    md += `| Feature | Interactions | Days Used |\n`
    md += `| --- | ---: | ---: |\n`
    for (const f of user.features) {
      md += `| ${f.feature} | ${f.interactions} | ${f.days_used} |\n`
    }
  } else {
    md += `No feature-level data recorded.\n`
  }
  md += '\n'

  // Features NOT used
  const usedFeatures = new Set(user.features.map((f) => f.feature))
  const unusedFeatures = team.all_features.filter((f) => !usedFeatures.has(f))
  if (unusedFeatures.length > 0) {
    md += `### Features Not Yet Tried\n\n`
    for (const f of unusedFeatures) {
      md += `- ${f}\n`
    }
    md += '\n'
  }

  // IDEs
  md += `### IDEs Used\n\n`
  if (user.ides.length > 0) {
    md += `| IDE | Interactions | Days Used |\n`
    md += `| --- | ---: | ---: |\n`
    for (const ide of user.ides) {
      md += `| ${ide.ide} | ${ide.interactions} | ${ide.days_used} |\n`
    }
  } else {
    md += `No IDE-level data recorded.\n`
  }
  md += '\n'

  // Models
  if (user.models.length > 0) {
    md += `### Models Used\n\n`
    md += `| Model | Interactions | Days Used |\n`
    md += `| --- | ---: | ---: |\n`
    for (const m of user.models) {
      md += `| ${m.model} | ${m.interactions} | ${m.days_used} |\n`
    }
    md += '\n'
  }

  // Team comparison
  md += `---\n\n`
  md += `## Team Context\n\n`
  md += `| Metric | Value |\n`
  md += `| --- | --- |\n`
  md += `| Team size | ${team.total_users} users |\n`
  md += `| Working days in period | ${team.working_days} |\n`
  md += `| Team avg interactions / user | ${team.avg_interactions_per_user} |\n`
  md += `| Team median interactions / user | ${team.median_interactions_per_user} |\n`
  md += `| Team avg days active / user | ${team.avg_days_active} |\n`
  md += '\n'

  // Champions
  md += `### Champions (top 5 by interactions)\n\n`
  md += `These users could be good contacts for tips and pairing:\n\n`
  md += `| User | Interactions |\n`
  md += `| --- | ---: |\n`
  for (const c of team.champions) {
    const marker = c.login === user.login ? ' ← (you)' : ''
    md += `| ${c.login}${marker} | ${c.interactions} |\n`
  }
  md += '\n'

  return md
}

export const generateUserPrompts = (
  usersSourcePath: string,
  includeUsers: string[] = [],
  excludeUsers: string[] = []
): ReportFile[] => {
  const userFiles = loadUserDailyFiles(
    usersSourcePath,
    includeUsers,
    excludeUsers
  )

  if (userFiles.length === 0) {
    core.info('No user data found, skipping enablement prompts')
    return []
  }

  // Filter to recent 20 working days
  const allDays = [...new Set(userFiles.map((f) => f.day as string))].sort()
  const workingDays = allDays.filter((d) => isWeekday(d))
  const recentWorkingDays = new Set(workingDays.slice(-20))
  const numDays = recentWorkingDays.size

  // Group files by user (only recent working days)
  const userFileMap = new Map<string, Record<string, unknown>[]>()
  for (const f of userFiles) {
    if (!recentWorkingDays.has(f.day as string)) continue
    const login = f.user_login as string
    if (!userFileMap.has(login)) userFileMap.set(login, [])
    userFileMap.get(login)!.push(f)
  }

  const logins = [...userFileMap.keys()].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  )

  // Build all profiles
  const profiles = logins.map((login) =>
    buildUserProfile(login, userFileMap.get(login)!, numDays)
  )

  // Also include users with no recent working-day data
  const allLogins = [
    ...new Set(userFiles.map((f) => f.user_login as string).filter(Boolean))
  ].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

  for (const login of allLogins) {
    if (!userFileMap.has(login)) {
      profiles.push(buildUserProfile(login, [], numDays))
    }
  }
  profiles.sort((a, b) =>
    a.login.toLowerCase().localeCompare(b.login.toLowerCase())
  )

  // Compute team stats
  const interactionValues = profiles.map((p) => p.total_interactions)
  const totalTeamInteractions = interactionValues.reduce((a, b) => a + b, 0)
  const allFeatures = [
    ...new Set(profiles.flatMap((p) => p.features.map((f) => f.feature)))
  ].sort()

  const champions = [...profiles]
    .sort((a, b) => b.total_interactions - a.total_interactions)
    .slice(0, 5)
    .map((p) => ({ login: p.login, interactions: p.total_interactions }))

  const teamStats: TeamStats = {
    total_users: profiles.length,
    working_days: numDays,
    avg_interactions_per_user: parseFloat(
      profiles.length > 0
        ? (totalTeamInteractions / profiles.length).toFixed(1)
        : '0'
    ),
    median_interactions_per_user: parseFloat(
      median(interactionValues).toFixed(1)
    ),
    avg_days_active: parseFloat(
      profiles.length > 0
        ? (
            profiles.reduce((a, p) => a + p.days_active, 0) / profiles.length
          ).toFixed(1)
        : '0'
    ),
    champions,
    all_features: allFeatures
  }

  // Generate one prompt file per user
  const files: ReportFile[] = []
  for (const profile of profiles) {
    const content = buildPromptMarkdown(profile, teamStats)
    const slug = profile.login.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()
    files.push({
      filename: `prompts/${slug}.md`,
      content
    })
  }

  core.info(`Generated ${files.length} enablement prompt(s)`)
  return files
}
