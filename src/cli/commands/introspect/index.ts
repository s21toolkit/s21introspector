import { Node } from "acorn"
import { command, flag, option, optional, positional } from "cmd-ts"
import { source } from "common-tags"
import { DocumentNode, print as printAst, printSchema } from "graphql"
import { Har } from "har-format"
import { resolve } from "node:path"
import { PLATFORM_TOKEN } from "@/cli/arguments/platform-token"
import { HarFile } from "@/cli/arguments/types/har-file"
import { NewFile } from "@/cli/arguments/types/new-file"
import { extractGqlLiterals } from "@/common/extract-gql-literals"
import { fetchStaticProperties } from "@/common/fetch-static-properties"
import { fetchTypeSchema } from "@/common/fetch-type-schema"
import { OperationRegistry } from "@/common/operation-registry"
import {
	fetchText,
	walkScriptsFromScript,
	walkScriptsFromWebpage,
} from "@/common/walk-scripts"
import { Constants } from "@/constants"

function getHarTextEntries(har: Har, mimeType: string) {
	return new Map(
		har.log.entries
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			.filter((entry) => entry.response.content.mimeType?.includes(mimeType))
			.map((entry) => [entry.request.url, entry.response.content.text!]),
	)
}

async function fetchGqlOperations(har?: Har) {
	const operationRegistry = new OperationRegistry()

	const loadedDocuments = har
		? getHarTextEntries(har, "html")
		: new Map<string, string>()

	const loadedScripts = har
		? getHarTextEntries(har, "javascript")
		: new Map<string, string>()

	if (har) {
		console.log("HAR loaded:")
		console.log("\tDocuments:", loadedDocuments.size)
		console.log("\tScripts:", loadedScripts.size)
	}

	async function getOrFetchText(url: string) {
		if (loadedDocuments.has(url)) {
			return loadedDocuments.get(url)!
		}

		if (loadedScripts.has(url)) {
			return loadedScripts.get(url)!
		}

		return await fetchText(url)
	}

	const documentUrls = new Set([
		Constants.Platform.BASE_URL,
		...loadedDocuments.keys(),
	])

	const visitedSources = new Set<string>()

	function scrapQueries(program: Node, _text: string, source: string) {
		console.log(
			`Scrapping queries from: ${source}`,
			loadedScripts.has(source) ? "-> Loaded from HAR" : "",
		)

		const literals = extractGqlLiterals(program)

		for (const literal of literals) {
			operationRegistry.addLiteral(literal)
		}
	}

	for (const url of documentUrls) {
		const visitedScripts = await walkScriptsFromWebpage(url, scrapQueries, {
			visitedSources,
			fetchText: getOrFetchText,
		})

		for (const script of visitedScripts) {
			visitedSources.add(script)
		}
	}

	for (const url of loadedScripts.keys()) {
		const visitedScripts = await walkScriptsFromScript(url, scrapQueries, {
			visitedSources,
			fetchText: getOrFetchText,
		})

		for (const script of visitedScripts) {
			visitedSources.add(script)
		}
	}

	return operationRegistry
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

function printGqlOperations(literals: DocumentNode[]) {
	return literals.reduce(
		(result, node) => `${result}\n\n${printAst(node)}`,
		"",
	)
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
			short: "s",
			description: "Only fetch types (and not queries)",
			defaultValue: () => false,
		}),
		har: positional({
			description: "HAR file to infer queries from",
			displayName: "har file",
			type: optional(HarFile),
		}),
	},
	async handler(argv) {
		const { accessToken, outFile, typesOnly, har } = argv

		console.log("Fetching schema")

		const [typeSchema, staticProperties] = await Promise.all([
			fetchTypeSchema(accessToken),
			fetchStaticProperties(),
		])

		const resolvedOutFile = resolveOutFile(outFile, staticProperties)

		let schema

		if (typesOnly) {
			schema = printSchema(typeSchema).trim()
		} else {
			const gqlOperations = await fetchGqlOperations(har)

			const validOperationDocuments = Array.from(
				gqlOperations.getValidOperations(false),
			)

			schema = source`
				${printSchema(typeSchema)}

				${printGqlOperations(validOperationDocuments)}
			`.trim()
		}

		await Bun.write(resolvedOutFile, schema)
	},
})
