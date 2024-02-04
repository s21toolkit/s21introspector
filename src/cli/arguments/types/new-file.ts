import { exists } from "fs/promises"
import { extendType, string } from "cmd-ts"
import { dirname, resolve } from "node:path"

export const NewFile = extendType(string, {
	async from(value) {
		const path = resolve(value)

		const directory = dirname(path)

		if (!(await exists(directory))) {
			throw new Error(`Directory \`${directory}\` does not exist`)
		}

		return path
	},
})
