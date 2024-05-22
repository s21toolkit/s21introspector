import { fetchStaticProperties } from "@/common/fetch-static-properties"
import { array, command, flag, multioption, string } from "cmd-ts"

export const staticCommand = command({
	name: "static",
	description: "Fetches static product info (version, URLs, etc.)",
	args: {
		selectors: multioption({
			long: "select",
			short: "s",
			description: "Select one or more properties for output",
			type: array(string),
		}),
		noName: flag({
			long: "no-name",
			short: "n",
			description: "Print only property value(s)",
			defaultValue: () => false,
		}),
	},
	async handler(argv) {
		const { selectors, noName } = argv

		const properties = await fetchStaticProperties()

		for (const [property, value] of properties) {
			if (selectors.length > 0 && !selectors.includes(property)) {
				continue
			}

			const namePrefix = noName ? "" : `${property}: `

			console.log(`${namePrefix}${value}`)
		}
	},
})
