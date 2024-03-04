import { Octokit } from "octokit";
import { program } from 'commander'
import { getBranchName } from "../get-branch-name";
import { DEFAULT_BRANCH_PREFIX } from "../constants";
import { OWNER, REPO } from "./constants";

interface IntTestCheckOptions {
    expectedPullNumber: string
    expectedRepoRoot: string
    expectedBranchPrefix: string
    expectedFromBranch: string
}

program
  .requiredOption('--expectedPullNumber <number>', 'The pull number that we created')
  .requiredOption('--expectedFromBranch <branch>', 'The branch we expect we synced from in the template repo')
  .option('--expectedBranchPrefix <prefix>', 'If the branch prefix is custom, the prefix we expect', DEFAULT_BRANCH_PREFIX)
  .option('--expectedRepoRoot <root>', 'The repo root where we expected the merge to occur', process.cwd())
  .helpCommand(true)

program.parse(process.argv)


/**
 * Important - this script calls expected values against the public-template-repo
 * and private template repo that should have the same template sync bases for integration
 * testing.
 * 
 * Please note, this is a baseline augmentation script. Please add more as we go and potentially,
 * we will want to instead trigger tests in a fully differently tests repo
 * 
 * The underlying @hanseltim/template-repo-sync library is where all combinations are more thoroughly
 * simulated
 * 
 * @param options 
 */
async function main(options: IntTestCheckOptions) {
    const pullNumber = parseInt(options.expectedPullNumber)

    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN
    })

    const repoUrl = `https://github.com/${OWNER}/${REPO}`
    const expectedBranchName = getBranchName({
      repoUrl,
      repoRoot: options.expectedRepoRoot,
      branchPrefix: options.expectedBranchPrefix,
      templateBranch: options.expectedFromBranch,
    })

    console.log(`Deleteing branch ${expectedBranchName}...`)
    await octokit.rest.git.deleteRef({
        owner: OWNER,
        repo: REPO,
        ref: `heads/${expectedBranchName}`
    })

    console.log(`Deleteing pull request ${pullNumber}...`)
    await octokit.rest.pulls.update({
        owner: OWNER,
        repo: REPO,
        pull_number: pullNumber,
        state: 'closed',
    })
}

void main(program.opts<IntTestCheckOptions>())