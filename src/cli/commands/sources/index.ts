import { command, option, optional, positional, string } from "cmd-ts"
import { createHash } from "node:crypto"
import { join } from "node:path"
import { NewFile } from "@/cli/arguments/types/new-file"
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
		webpageUrl: positional({
			type: optional(string),
			description: "Webpage to download sources from",
			displayName: "webpage url",
		}),
		outDir: option({
			long: "out-dir",
			short: "o",
			type: optional(NewFile),
			description: "Directory for downloaded sources",
			defaultValue: () => undefined,
		}),
	},
	async handler(argv) {
		const webpageUrl = argv.webpageUrl ?? Constants.Platform.BASE_URL
		const outDir = argv.outDir ?? webpageUrl.replaceAll(/[^\w\d]+/g, "-")

		const writePromises: Promise<unknown>[] = []

		await walkScriptsFromWebpage(webpageUrl, (_program, text, source) => {
			const url = new URL(source)

			const filename =
				url.pathname === "/" ? createRootScriptFilename(text) : url.pathname

			const writePromise = Bun.write(join(outDir, filename), text)

			writePromises.push(writePromise)
		})

		await Promise.all(writePromises)
	},
})
