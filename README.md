# Template Repo Sync Github Action

This action attempts to establish a tooling system around the problem set of handling template repositories
that do not have a shared git history (i.e. Github Template repos or repos imported, not forked, from another repo).

IMPORANT - V2 uses [template-repo-sync v2](https://github.com/HanseltimeIndustries/template-repo-sync), which changes
the way the merge field works! You must make sure that all repos change that config and versions.

- [Template Repo Sync Github Action](#template-repo-sync-github-action)
  - [What it does](#what-it-does)
  - [What already exists](#what-already-exists)
- [Usage](#usage)
  - [Configuration](#configuration)
  - [Authorization](#authorization)
    - [Authentication to the template repository](#authentication-to-the-template-repository)
      - [Recommended - Github Application](#recommended---github-application)
      - [Cheaper - PAT](#cheaper---pat)
    - [Authentication to write back to the current repository](#authentication-to-write-back-to-the-current-repository)
    - [1. Using a Github app for PR and template](#1-using-a-github-app-for-pr-and-template)
    - [2. Using a PAT for PR and template](#2-using-a-pat-for-pr-and-template)
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
    description: "The github token with access to write content and write pull requests on this repo"
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

There are two forms of potentially different authentication that you need for this action:

1. Authentication to read from the template repository
2. Authentication to write back to the current repository

**Note:** The current iteration of this action only supports coordinating between github repos. With the addition of
a few fields, we could enable git connection to other source template repos. For now, it is not enabled until a
good example of configuring the git client for such cross-hosting is provided. Please feel free to contribute!

### Authentication to the template repository

If your template repository if public, then you don't need to authenticate to pull more information the template repository.

If your template repository is private however, you will need to provide a `remoteRepoToken` that has permissions to read
contents from the remote repository. Since the normal `GITHUB_TOKEN` that might be used with `actions/checkout` only scopes
to the current repository, you will need to either have a PAT or a github application that has read permissions for your template
repository.

#### Recommended - Github Application

The most secure solution for accessing a private template repository would be to create a Github Application in your organization
like `template-repo-reader` and then grant it `content` permissions on your template repository. After that, if you follow the flows
below and reference the private key and app id, your derived repositories can use the same application to read the repository.

#### Cheaper - PAT

If you are on a Github license that does not allow you to set up Github applications (anything lower than a Team paid membership), then
you will need to create and store a PAT with scoped read permissions to the template repository. And provide it as specified in the
following flows.

### Authentication to write back to the current repository

Because this action does both the opening of a PR and the creation of brand new branch, you have a few options
authorizing those separate actions.

Regardless of the type of token you create, you should have the following permissions:

- Contents - Read & Write
- Pull Requests - Read and Write
- Workflow - Read & Write (unless you can guarantee that you will never update github actions files from the template)

**Note** - Workflow permissions are not something permitted via the normal Github Actions `permissions:` field. You will need to
either use a PAT or Github Application if you want to sync github workflows.

If you can ensure that you will never be synchronizing github actions workflows (by ensuring that
you ignore `.github/**/*`), then you can forgo the Workflow permission as well. If not, you will have to use the
correct PAT or github application with your `actions/checkout`.

### 1. Using a Github app for PR and template

You can create and use a [GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps) to handle access to the private template repository.
To generate a token for your app you can use a separate action like [actions/create-github-app-token](https://github.com/actions/create-github-app-token).
You have to set up the checkout step with the generated token as well.

The following flow shows the best practice for having a separate app that you have made to write back to your repository and a "read template" app.
You have made the private keys and app ids available as secrets (org secrets to avoid copy-paste fatigue if your security is strong enough).

```yaml
jobs:
  repo-sync:
    runs-on: ubuntu-latest
    steps:
      - name: Generate token to read from template repo
        id: generate_template_token
        uses: actions/create-github-app-token
        with:
          app-id: ${{ secrets.TEMPLATE_READ_APP_ID }}
          private-key: ${{ secrets.TEMPLATE_READ_PRIVATE_KEY }}
          owner: ${{ github.repository_owner }} # Necessary since we're reaching out to not-this-repo
     - name: Generate token to read from source repo
        id: generate_write_token
        uses: actions/create-github-app-token
        with:
          app-id: ${{ secrets.WRITE_BACK_APP_ID }}
          private-key: ${{ secrets.WRITE_BACK_PRIVATE_KEY }}
      - name: Checkout
        uses: actions/checkout@v6
        with:
          token: ${{ steps.generate_write_token.outputs.token }}
      - name: repo-sync
        uses: hanseltimeindustries/template-repo-sync-action@v1
        with:
          githubToken: ${{ steps.generate_write_token.outputs.token }} # Presumes this app has pull request permissions
          remoteRepoToken: ${{ steps.generate_template_token.outputs.token }} # Used to read the template repo
          repoPath: <owner/repo>
          templateBranch: <branch on the template to use>
          prToBranch: <branch on this repo we want to update>
```

### 2. Using a PAT for PR and template

A [Personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) is an alternative to using passwords for authentication to GitHub, but unlike
a github app, is still attributed to an authorizing user. As such, we recommend the Github App route for any
organizational loads, but provide these instructions here in the event that storing a PAT is less concerning.

You will want to create a fine-grained PAT with the above listed permissions to both your source repo and template repo.

```yml
jobs:
  repo-sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          token: ${{ secrets.SYNC_PAT }}
      - name: repo-sync
        uses: hanseltimeindustries/template-repo-sync-action@v1
        with:
          repoPath: <owner/repo>
          # Here we use the github token for pull request creation as if we didn't give the sync token the permission
          githubToken: ${{ secrets.SYNC_PAT }}
          remoteRepoToken: ${{ secrets.SYNC_PAT }}
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
  "merge": [
    {
      "glob": "**/*.json",
      "plugin": "_json",
      "options": {
        "paths": [
          ["$.scripts", "merge-template"],
          ["$.devDependencies", "merge-template"]
        ]
      }
    }
  ]
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
