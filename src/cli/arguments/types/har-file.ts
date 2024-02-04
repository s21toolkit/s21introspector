import { extendType } from "cmd-ts"
import { File } from "cmd-ts/batteries/fs"
import type { Har } from "har-format"
import { readFile } from "node:fs/promises"
import { extname } from "node:path"

export const HarFile = extendType(File, {
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
