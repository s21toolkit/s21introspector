import { command, option } from "cmd-ts"
import { createHash } from "node:crypto"
import { join } from "node:path"
import { NewFile } from "@/cli/arguments/types/NewFile"
import { walkScriptsFromWebpage } from "@/common/walk-scripts"
import { Constants } from "@/constants"

function createRootScriptFilename(text: string) {
	const hash = createHash("md5").update(text).digest("hex")

	return `root-${hash}.js`
}

export const sourcesCommand = command({
	name: "sources",
	description: "Walks and downloads all JS sources from the platform",
	args: {
		outDir: option({
			long: "out-dir",
			short: "o",
			type: NewFile,
			description: "Directory for downloaded sources",
			defaultValue: () => "edu-src",
		}),
	},
	async handler(argv) {
		const { outDir } = argv

		const writePromises: Promise<unknown>[] = []

		await walkScriptsFromWebpage(
			Constants.Platform.BASE_URL,
			(_program, text, source) => {
				const url = new URL(source)

				const filename =
					url.pathname === "/"
						? createRootScriptFilename(text)
						: url.pathname

				const writePromise = Bun.write(join(outDir, filename), text)

				writePromises.push(writePromise)
			},
		)

		await Promise.all(writePromises)
	},
})
