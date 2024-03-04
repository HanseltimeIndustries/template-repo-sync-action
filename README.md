# Template Repo Sync Github Action

This action attempts to establish a tooling system around the problem set of handling template repositories
that do not have a shared git history (i.e. Github Template repos or repos imported, not forked, from another repo).

- [Template Repo Sync Github Action](#template-repo-sync-github-action)
  - [What it does](#what-it-does)
  - [What already exists](#what-already-exists)
- [Usage](#usage)
  - [Configuration](#configuration)
  - [Authorization](#authorization)
    - [1. Using a Github app](#1-using-a-github-app)
- [Example Use Case](#example-use-case)
<!-- Created with Markdown All in One Plugin in VsCode, rerun to update -->

## What it does

This action will grab the most recent "template" repo that you specify and then apply merge rules
based on `@hanseltime/template-repo-sync` between the repo using the action and the template. Once it has
applied the rules, it will push a branch and open a pull request to your specified branch with a pull request
comment that indicates any "merge" operations that were different than just overriding files with the files
in the template repo.

## What already exists

There are many solutions that exist to this problem, but each of them have their own edges.

- [LockBlocks](https://github.com/justinmahar/lockblocks)
- [actions-template-sync](https://github.com/marketplace/actions/actions-template-sync)
- [action-template-repository-sync](https://github.com/ahmadnassri/action-template-repository-sync)

This action and it's underlying library intends to solve:

1. Extensibity - a pluggable system that could use other merging libraries like LockBlocks
   - See `@hanseltime/template-repo-sync` as the underlying framework
2. Template and Extending Repo Agency - providing a standard way for those in the extending repo to
   reject or tweak the changes between the two repos
3. Sync Tracking - a way to ensure that we don't keep rehashing decisions from previous commits on
   subsequent merges

# Usage

A good example for usage can be found in the integration test flows that we set up in [test-flow](.github/workflows//test-flow.yaml)

## Configuration

```yaml
uses: hanseltime/template-repo-sync-action@v1
with:
  repoPath:
    description: "The owner/repo path of the repo on github"
    required: true
  githubToken:
    description: "The github token with access to write pull requests on this repo"
    required: true
  remoteRepoToken:
    description: A separate github token with permissions to clone from the other repo.  Only needed for private repos
    required: false
  repoRoot:
    description: "The root in this github repo that we are syncing.  This is mainly for things like monorepos."
    required: false
  templateBranch:
    description: "The branch on the template that we want to sync to"
    required: true
  branchPrefix:
    description: "A short branch prefix for the branch that will be created in order to store the changes"
    required: false
  commitMsg:
    description: "The commit message to supply when making the merge commits"
    required: false
  titleMsg:
    description: "The title of the pull request"
    required: false
  prToBranch:
    description: This is the branch to open the pull request to.  If not set, this uses the repo's default branch.
    required: false
  updateAfterRef:
    description: Whether we want to override the templatesync.local.json file with the template repo's last sha from the sync
    required: false
    default: "true"
```

## Authorization

Because this action does both the opening of a PR and the creation of brand new branch, you have a few options
authorizing those separate actions.

**Note:** The current iteration of this action only supports coordinating between github repos, with the addition of
a few fields, we could enable git connection to other source template repos. For now, it is not enabled until a
good example of configuring the git client for such cross-hosting is provided. Please feel free to contribute!

### 1. Using a Github app

You can create and use a [GitHub App][github-app] to handle access to the private template repository.
To generate a token for your app you can use a separate action like [tibdex/github-app-token][github-app-token].
You have to set up the checkout step with the generated token as well.

```yaml
jobs:
  repo-sync:
    runs-on: ubuntu-latest

    steps:
     - name: Generate token to read from source repo # see: https://github.com/tibdex/github-app-token
        id: generate_token
        uses: tibdex/github-app-token@v1
        with:
          app_id: ${{ secrets.APP_ID }}
          private_key: ${{ secrets.PRIVATE_KEY }}

      - name: Checkout
        uses: actions/checkout@v4
        with:
          # Make sure to set the checkout client token since it is what pushes the new branch
          token: ${{ steps.generate_token.outputs.token }}

      - name: repo-sync
        uses: hanseltimeindustries/template-repo-sync-action@v1
        with:
          # Setting the token here enables pull request creation
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          remoteRepoToken: ${{ steps.generate_token.outputs.token }}
          repoPath: <owner/repo>
          templateBranch: <branch on the template to use>
          prToBranch: <branch on this repo we want to update>
```

2. Using a PAT

A [Personal access token][github-pat] is an alternative to using passwords for authentication to GitHub, but unlike
a github app, is still attributed to an authorizing user. As such, we recommend the Github App route for any
organizational loads, but provide these instructions here in the event that storing a PAT is less concerning.

You will want to create a fine-grained PAT with the following permissions to both your source repo and template repo:

- Contents - Read & Write

The token just needs to be supplied for remote access. **NOTE** if you are accessing a public repo, there is no need
for a PAT.

```yml
jobs:
  repo-sync:
    runs-on: ubuntu-latest

    steps:
     - name: Generate token to read from source repo # see: https://github.com/tibdex/github-app-token
        id: generate_token
        uses: tibdex/github-app-token@v1
        with:
          app_id: ${{ secrets.APP_ID }}
          private_key: ${{ secrets.PRIVATE_KEY }}

      - name: Checkout
        uses: actions/checkout@v4
        with:
          # Make sure to set the checkout client token since it is what pushes the new branch
          token: ${{ steps.generate_token.outputs.token }}

      - name: repo-sync
        uses: hanseltimeindustries/template-repo-sync-action@v1
        with:
          repoPath: <owner/repo>
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          remoteRepoToken: ${{ secrets.PRIVATE_TEMPLATE_PAT }}
          templateBranch: main
```

# Example Use Case

Let's say that I have created a template repo for an npm package that I intend to use with all my npm pacakges.
As part of the repo, I provide some example files, configs, and a basic package json with dependencies and scripts.
Additionally, I make sure to provide a github action that performs auto-sync so that repo owners will make use of it

```
./
  .github/
    workflows/
      sync-repo.yml    # I would recommend setting it up with a CRON if you can
  src/
    index.ts
    index.test.ts
  package.json
  jest.config.js
  tsconfig.json
  README.md
  TEMPLATE_INSTRUCTIONS.MD  # Certainly make setting up the sync-repo.yml part of these instructions
```

Looking at the template repo, I will also crate a `templatesync.json` file in the root:

```json
{
  "ignore": ["src/**/*"],
  "merge": {
    ".json": {
      "rules": [
        {
          "glob": "package.json",
          "options": {
            "paths": [
              ["$.scripts", "merge-template"],
              ["$.devDependencies", "merge-template"]
            ]
          }
        }
      ]
    }
  }
}
```

What does this do?

- We make sure to ignore merging all files in the `src/` directory since they're only there as an example and we don't want to override
  anything.
- We also make sure to setup a merge rule for us to only merge scripts, and devDependencies on sync. We do make sure that the template overrides
  the local repo, since we assume any updates from us shouldn't get ignored.

  One of the main wins of this config, is that we will never overwrite things like repository, name, description, which are meant to be decided
  on by the repo owner when they started with the template.

Now, let's say that you created a new repo from this template, and went ahead and drastically update the jest.config.js file to the point where
you have decided this is a custom one-off.

In your repo, you can now add a `templatesync.local.json` file:

```json
{
  "ignore": ["jest.config.js"]
}
```

When you run your `sync-repo` action (however, you configured it), you will end up getting a message that we skipped jest.config.js even
though there were some changes. The PR provided will have all other changes as directed by the template's sync config.