import { execSync } from "child_process"
import { createHash } from "crypto"
import { existsSync, readFileSync } from "fs"
import { resolve } from "path"
import { TEMPLATE_SYNC_LOCAL_CONFIG } from '@hanseltime/template-repo-sync'

interface GetBranchNameOptions {
    templateBranch: string
    repoUrl: string
    repoRoot: string
    branchPrefix: string
}

export function getBranchName(options: GetBranchNameOptions) {
    const { branchPrefix, repoRoot, repoUrl, templateBranch } = options
    const shaLine = execSync(`git ls-remote "${repoUrl}" "${templateBranch}"`).toString().split(' ')[0]
    const match = /^(?<hash>[^\s]+)\s/.exec(shaLine)
    const templateSha = match?.groups?.hash
    if (!templateSha) {
        throw new Error(`Could not get the current sha of ${repoUrl} for ${templateBranch}`)
    }

    let configHash: string
    if (existsSync(resolve(repoRoot, TEMPLATE_SYNC_LOCAL_CONFIG))) {
        configHash = createHash('sha256').update(readFileSync(resolve(repoRoot, TEMPLATE_SYNC_LOCAL_CONFIG))).digest('hex').slice(0, 8)
    } else {
        configHash = 'noLocalConfig'
    }

    return `${branchPrefix}${templateSha.slice(0, 8)}-${configHash}`
}
