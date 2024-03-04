import * as core from "@actions/core";
import { GithubOptions, syncGithubRepo } from "./sync-github-repo";

const options: GithubOptions = {
  repoPath: core.getInput("repoPath"),
  githubToken: core.getInput("githubToken"),
  templateBranch: core.getInput("templateBranch"),
  repoRoot: core.getInput("repoRoot") || undefined,
  branchPrefix: core.getInput("branchPrefix") || undefined,
  commitMsg: core.getInput("commitMsg") || undefined,
  titleMsg: core.getInput("titleMsg") || undefined,
  prToBranch: core.getInput("prToBranch") || undefined,
  remoteRepoToken: core.getInput("remoteRepoToken") || undefined,
  updateAfterRef: core.getInput("updateAfterRef").toLowerCase() === "true",
};

void syncGithubRepo(options);
