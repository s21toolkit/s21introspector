import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { extendType, string } from "cmd-ts"

export const NewFile = extendType(string, {
	async from(value) {
		const path = resolve(value)

		const directory = dirname(path)

		if (!existsSync(directory)) {
			throw new Error(`Directory \`${directory}\` does not exist`)
		}

		return path
	},
})
