import { Octokit } from "octokit";
import { execSync } from "child_process";
import { program } from "commander";
import { DEFAULT_BRANCH_PREFIX, DEFAULT_TITLE_MSG } from "../constants";
import { getBranchName } from "../get-branch-name";
import { OWNER, REPO } from "./constants";
import { withoutGhExtraHeader } from "../git-utils";

interface IntTestCheckOptions {
	expectedRepoRoot: string;
	expectedBranchPrefix: string;
	expectedPullNumber: string;
	expectedToBranch: string;
	expectedFilesChanged: string;
	expectedTitle: string;
	expectedFromBranch: string;
	expectedFromRepoPath: string;
	remoteRepoToken: string;
}

program
	.requiredOption(
		"--expectedPullNumber <number>",
		"The pull number that was expected to be created",
	)
	.requiredOption(
		"--expectedToBranch <branch>",
		"The branch that this pr should be opened against",
	)
	.requiredOption(
		"--expectedFilesChanged <files...>",
		"The file paths (relative to root) that should be changed",
	)
	.requiredOption(
		"--expectedFromBranch <branch>",
		"The branch we expect we synced from in the template repo",
	)
	.requiredOption(
		"--expectedFromRepoPath <repo>",
		"The ower/repo we expect we synced from in the template repo",
	)
	.option(
		"--remoteRepoToken <token>",
		"If you need to auth to the remote repo, supply a read token",
	)
	.option(
		"--expectedTitle <title>",
		"If the title is custom, the title to match",
		DEFAULT_TITLE_MSG,
	)
	.option(
		"--expectedBranchPrefix <prefix>",
		"If the branch prefix is custom, the prefix we expect",
		DEFAULT_BRANCH_PREFIX,
	)
	.option(
		"--expectedRepoRoot <root>",
		"The repo root where we expected the merge to occur",
		process.cwd(),
	)
	.helpCommand(true);

program.parse(process.argv);

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
	const pullNumber = parseInt(options.expectedPullNumber);

	console.log(`options is: ${JSON.stringify(options, null, 4)}`);

	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN,
	});

	const repoUrl = options.remoteRepoToken
		? `https://github_actions:${options.remoteRepoToken}@github.com/${options.expectedFromRepoPath}`
		: `https://github.com/${options.expectedFromRepoPath}`;
	console.log("branchPrefix" + options.expectedBranchPrefix);
	const templateBranchOpts = {
		repoUrl,
		repoRoot: options.expectedRepoRoot,
		branchPrefix: options.expectedBranchPrefix,
		templateBranch: options.expectedFromBranch,
	};
	const expectedBranchName = options.remoteRepoToken
		? withoutGhExtraHeader(() => getBranchName(templateBranchOpts))
		: getBranchName(templateBranchOpts);

	const branchOutput = execSync(
		`git ls-remote --heads origin ${expectedBranchName}`,
	)
		.toString()
		.trim();
	if (!branchOutput.includes(expectedBranchName)) {
		throw new Error(`Expected ${expectedBranchName} to be on the repo2`);
	}

	execSync(`git fetch origin ${expectedBranchName}`);
	execSync(`git fetch origin ${options.expectedToBranch}`);

	const filesStr = execSync(
		`git diff --name-only "origin/${expectedBranchName}" "origin/${options.expectedToBranch}"`,
	)
		.toString()
		.trim();

	const expectedFilesSet = new Set(options.expectedFilesChanged);
	const additionalFiles: string[] = [];
	filesStr.split("\n").forEach((f) => {
		if (expectedFilesSet.has(f)) {
			expectedFilesSet.delete(f);
		} else {
			additionalFiles.push(f);
		}
	});

	if (expectedFilesSet.size > 0 || additionalFiles.length > 0) {
		throw new Error(
			"Expected file changes did not match!\n" +
				`Additional files changed that were not expected: ${JSON.stringify(additionalFiles)}\n` +
				`Files that were expected but not found: ${JSON.stringify(Array.from(expectedFilesSet))}`,
		);
	}

	const prResp = await octokit.rest.pulls.get({
		owner: OWNER,
		repo: REPO,
		pull_number: pullNumber,
	});

	if (prResp.status !== 200) {
		throw new Error(`Could not find PR ${options.expectedPullNumber}`);
	}

	if (prResp.data.title !== options.expectedTitle) {
		throw new Error(
			`PR title (${prResp.data.title}) did not match ${options.expectedTitle}`,
		);
	}
}

void main(program.opts<IntTestCheckOptions>());
