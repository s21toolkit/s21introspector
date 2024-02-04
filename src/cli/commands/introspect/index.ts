import { command, flag, option } from "cmd-ts"
import { source } from "common-tags"
import { printSchema } from "graphql"
import { resolve } from "node:path"
import { PLATFORM_TOKEN } from "@/cli/arguments/platform-token"
import { NewFile } from "@/cli/arguments/types/new-file"
import { extractGqlLiterals } from "@/common/extract-gql-literals"
import { fetchStaticProperties } from "@/common/fetch-static-properties"
import { fetchTypeSchema } from "@/common/fetch-type-schema"
import { walkScriptsFromWebpage } from "@/common/walk-scripts"
import { Constants } from "@/constants"

async function fetchGraphqlLiterals() {
	const gqlLiterals: string[] = []

	await walkScriptsFromWebpage(Constants.Platform.BASE_URL, (program) => {
		gqlLiterals.push(...extractGqlLiterals(program))
	})

	return gqlLiterals
}

function resolveOutFile(
	outFile: string,
	staticProperties: Map<string, string>,
) {
	const resolvedOutFile = outFile.replaceAll(
		/{(?<placeholder>[\w\d_$-]+)}/g,
		(_match, placeholder) => {
			return staticProperties.get(placeholder) ?? ""
		},
	)

	return resolve(resolvedOutFile)
}

function printGqlLiterals(literals: string[]) {
	return literals.reduce((a, b) => `${a.trim()}\n\n${b.trim()}`, "")
}

export const introspectCommand = command({
	name: "introspect",
	description: "Fetches GQL schema (requires authorization)",
	args: {
		...PLATFORM_TOKEN,
		outFile: option({
			type: NewFile,
			long: "out-file",
			short: "o",
			description:
				"Output schema file (supports {substitutions} for static properties)",
			defaultValue: () => "schema_{PRODUCT_VERSION}.gql",
		}),
		typesOnly: flag({
			long: "types-only",
			short: "t",
			description: "Only fetch types (and not queries)",
			defaultValue: () => false,
		}),
	},
	async handler(argv) {
		const { accessToken, outFile, typesOnly } = argv

		const [typeSchema, staticProperties] = await Promise.all([
			fetchTypeSchema(accessToken),
			fetchStaticProperties(),
		])

		const gqlLiterals = typesOnly ? [] : await fetchGraphqlLiterals()

		const resolvedOutFile = resolveOutFile(outFile, staticProperties)

		const schema = source`
			${printSchema(typeSchema)}

			${printGqlLiterals(gqlLiterals)}
		`.trim()

		await Bun.write(resolvedOutFile, schema)
	},
})
