import * as core from '@actions/core'
import * as github from '@actions/github'

export const getConnectedUser = async ({
  githubToken
}: {
  githubToken: string
}): Promise<string> => {
  const octokit = github.getOctokit(githubToken)

  const {
    data: { login }
  } = await octokit.rest.users.getAuthenticated()

  core.info(`Successfully authenticated to GitHub as: ${login}`)

  return login
}
