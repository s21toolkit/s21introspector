import { readFile } from "node:fs/promises"
import { extname } from "node:path"
import { extendType } from "cmd-ts"
import cmdTsFs from "cmd-ts/dist/cjs/batteries/fs.js"
import type { Har } from "har-format"

export const HarFile = extendType(cmdTsFs.File, {
	async from(path) {
		const extension = extname(path)

		if (extension !== ".har") {
			throw new Error(
				`Unsupported \`${extension}\` file format, expected HAR file`,
			)
		}

		const data = await readFile(path, "utf-8")

		const har = JSON.parse(data) as Har

		return har
	},
})
