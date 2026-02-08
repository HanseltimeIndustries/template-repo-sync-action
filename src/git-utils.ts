import { execSync } from "child_process";

const EXPECTED_EXTRA_HEADER_ATTACH = "https://github.com/";
const SCOPE_KEY = `http.${EXPECTED_EXTRA_HEADER_ATTACH}.extraheader`;

/**
 * Wraps a callback where we are making git calls so that it can remove the default Github extraheaders
 * that might interfere with the other CLI calls.
 *
 * This is necessary for calling private template repo git actions when `actions/checkout` has persisted
 * credentials (which is nice for most people doing other git commands in the same workflow on their triggering
 * repo).
 *
 * Use this when you are explicitly controlling the auth to a github repo
 * @param cb A callback that makes git commands
 * @returns
 */
export function withoutGhExtraHeader<T>(cb: () => T) {
	console.log("Looking up existing local github extraheaders...");
	// Get existing headers that might ahve been configured
	let existingHeaders: string[] = [];
	try {
		const raw = execSync(`git config --local --get-all ${SCOPE_KEY}`, {
			stdio: ["ignore", "pipe", "ignore"],
		})
			.toString()
			.trim();

		if (raw) {
			existingHeaders = raw.split("\n");
		}
	} catch (err: unknown) {
		let skip = false;
		if (err instanceof Error && "status" in err) {
			const status = (err as { status: number }).status;

			if (status === 1) {
				console.warn(
					`No local extraheaders configured for git client - ${SCOPE_KEY}.`,
				);
				skip = true;
			} else {
				console.error(`Git config lookup failed with status ${status}`);
			}
		}

		if (!skip) {
			throw err;
		}
	}

	try {
		console.log("Overriding local github extraheaders...");
		// Override the header at the local repo level
		execSync(`git config --local --replace-all ${SCOPE_KEY} ""`);
		return cb();
	} finally {
		console.log("Restoring local github extraheaders...");
		// Add back any local headers or unset our override
		if (existingHeaders.length > 0) {
			for (const header of existingHeaders) {
				execSync(`git config --local --add ${SCOPE_KEY} "${header}"`);
			}
		} else {
			execSync(`git config --local --unset-all ${SCOPE_KEY}`);
		}
	}
}
