import * as github from '@actions/github'
import * as core from '@actions/core'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtemp } from 'fs/promises'
import { execSync } from 'child_process'
import { syncResultsToMd, TEMPLATE_SYNC_LOCAL_CONFIG, templateSync } from '@hanseltime/template-repo-sync'
import { DEFAULT_BRANCH_PREFIX, DEFAULT_COMMIT_MSG, DEFAULT_TITLE_MSG } from './constants'
import { getBranchName } from './get-branch-name'

export interface GithubOptions {
    /**
     * The owner/repo path of the repo on github
     */
    repoPath: string

    /** A github token with access to write pull requests */
    githubToken: string

    /**
     * Normally, this should be the working directory of a github action, but this
     * could also be an internal file depending on things like monorepo structures
     */
    repoRoot?: string

    /**
     * The branch on the template that we want to sync to
     */
    templateBranch: string

    /** A short branch prefix for the branch that will be created in order to store the changes */
    branchPrefix?: string

    /**
     * The commit message to supply when making the merge commits
     */
    commitMsg?: string

    /**
     * The title of the pull request
     */
    titleMsg?: string

    /**
     * This is the branch to open the pull request to.  If not set, we will use the
     * repo's default branch.
     */
    prToBranch?: string
}

function getTempDir() {
    return process.env['RUNNER_TEMP'] || tmpdir()
}


export async function syncGithubRepo(options: GithubOptions) {

    const octokit = github.getOctokit(options.githubToken)

    const repoRoot = options.repoRoot ?? process.cwd()
    const branchPrefix = options.branchPrefix ?? DEFAULT_BRANCH_PREFIX
    const commitMsg = options.commitMsg ? options.commitMsg : DEFAULT_COMMIT_MSG

    // Note, we use git here so that we can change this around for other git providers more easily
    const repoUrl = `https://github.com/${options.repoPath}`

    const branchName = getBranchName({
        branchPrefix,
        templateBranch: options.templateBranch,
        repoUrl,
        repoRoot,
    })

    // Check if the branch exists already and skip
    const output = execSync(`git ls-remote --heads origin "${branchName}"`).toString().trim()
    // Non-empty output means the branch exists
    if (output) {
        core.warning(`The exact same combination of ${TEMPLATE_SYNC_LOCAL_CONFIG} and remote ${options.templateBranch} has been run before`)
        core.warning(`If you would like to re-run due to plugins, etc.  Please delete branch: ${branchName}`)
        // Error this
        process.exit(1)
    }

    // Checkout the branch
    execSync(`git checkout -b ${branchName}`)

    // Clone and merge on this branch
    const tempAppDir = await mkdtemp(join(getTempDir(), 'template_sync_'))

    const result = await templateSync({
        tmpCloneDir: tempAppDir,
        repoDir: options.repoRoot ?? process.cwd(),
        repoUrl: `https://github_actions:${process.env.CLONE_PAT}@github.com/${options.repoPath}.git`,
    })

    // commit everything
    execSync('git add .')
    execSync(`git commit -m "${commitMsg}"`)
    execSync(`git push --set-upstream origin "${branchName}"`)

    let prToBranch = options.prToBranch
    if (!prToBranch) {
        const resp = await octokit.rest.repos.get({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
        })
        prToBranch = resp.data.default_branch
    }


    const resp = await octokit.rest.pulls.create({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        head: branchName,
        base: prToBranch,
        title: DEFAULT_TITLE_MSG,
        body: `
Template Synchronization Operation of ${repoUrl} ${options.templateBranch}

${syncResultsToMd(result)}
`
    })

    core.setOutput("prNumber", resp.data.number)
}
