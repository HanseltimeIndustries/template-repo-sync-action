import { readFileSync } from "fs";
import { syncGithubRepo } from "./ci-actions/github";
import { join } from "path";

process.env.GITHUB_REPOSITORY = 'HanseltimeIndustries/template-repo-sync'

void syncGithubRepo({
    githubToken: readFileSync(join('tmp', 'token')).toString(),
    repoPath: 'HanseltimeIndustries/test-private-template',
    templateBranch: 'main',
})