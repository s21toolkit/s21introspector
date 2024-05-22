import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { PLATFORM_TOKEN } from "@/cli/arguments/platform-token"
import { HarFile } from "@/cli/arguments/types/har-file"
import { NewFile } from "@/cli/arguments/types/new-file"
import { extractGqlLiterals } from "@/common/extract-gql-literals"
import { fetchStaticProperties } from "@/common/fetch-static-properties"
import { fetchTypeSchema } from "@/common/fetch-type-schema"
import {
	fetchText,
	walkScriptsFromScript,
	walkScriptsFromWebpage,
} from "@/common/walk-scripts"
import { Constants } from "@/constants"
import type { Node } from "acorn"
import {
	boolean,
	command,
	flag,
	option,
	optional,
	positional,
	string,
} from "cmd-ts"
import { source } from "common-tags"
import { type DocumentNode, print as printAst, printSchema } from "graphql"
import type { Har } from "har-format"
import { OperationRegistry } from "./operation-registry"

function getHarTextEntries(har: Har, mimeType: string) {
	return new Map(
		har.log.entries
			.filter((entry) => entry.response.content.mimeType?.includes(mimeType))
			// biome-ignore lint/style/noNonNullAssertion: expected to be non-null
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
			// biome-ignore lint/style/noNonNullAssertion: has already been checked
			return loadedDocuments.get(url)!
		}

		if (loadedScripts.has(url)) {
			// biome-ignore lint/style/noNonNullAssertion: has already been checked
			return loadedScripts.get(url)!
		}

		return await fetchText(url)
	}

	const documentUrls = new Set([
		Constants.Platform.BASE_URL,
		// Constants.Platform.Admin.BASE_URL,
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
	aliases: ["@"],
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
		splitOperations: flag({
			short: "p",
			long: "split-operations",
			description:
				"Put operations (queries, mutations, etc.) into one separate file, `out-file` becomes output directory",
			defaultValue: () => false,
		}),
		deduplicateFragments: flag({
			short: "d",
			long: "deduplicate-fragments",
			description:
				"Remove duplicated fragments (by default disabled for `isolate-operations`, enabled otherwise)",
			type: optional(boolean),
			defaultValue: () => undefined,
		}),
		isolateOperations: flag({
			short: "i",
			long: "isolate-operations",
			description:
				"Put each operation (query, mutation, etc.) into a separate file, `out-file` becomes output directory",
			defaultValue: () => false,
		}),
		gqlFileExtension: option({
			short: "e",
			long: "gql-file-extension",
			description:
				"File extension for generated GQL files (used with `isolate-operations` and `split-operations`)",
			type: optional(string),
			defaultValue: () => undefined,
		}),
	},
	async handler(argv) {
		const {
			accessToken,
			outFile,
			typesOnly,
			splitOperations,
			isolateOperations,
			har,
		} = argv

		const gqlFileExtension = argv.gqlFileExtension ?? "gql"

		console.log("Fetching schema")

		const [typeSchema, staticProperties] = await Promise.all([
			fetchTypeSchema(accessToken),
			fetchStaticProperties(),
		])

		const resolvedOutFile = resolveOutFile(outFile, staticProperties)

		// TODO: Refactor this

		if (splitOperations && isolateOperations) {
			console.error(
				"`isolate-operations` and `split-operations` are mutually exclusive",
			)
			process.exit(1)
		}

		if (isolateOperations) {
			if (typesOnly) {
				console.error(
					"`types-only` is not allowed with `isolate-operations`",
				)
				process.exit(1)
			}

			const deduplicateFragments = argv.deduplicateFragments ?? false

			const schemaFile = resolve(
				resolvedOutFile,
				`./schema.${gqlFileExtension}`,
			)
			const operationDirectory = resolve(resolvedOutFile, "./operations")

			const schema = printSchema(typeSchema).trim()
			const operations = await fetchGqlOperations(har)

			await writeFile(schemaFile, schema)

			for (const operation of operations.getValidOperations(
				!deduplicateFragments,
			)) {
				const operationFile = resolve(
					operationDirectory,
					`${operation.name}.${gqlFileExtension}`,
				)

				await writeFile(operationFile, printAst(operation.node).trim())
			}

			return
		}

		if (splitOperations) {
			if (typesOnly) {
				console.error("`types-only` is not allowed with `split-operations`")
				process.exit(1)
			}

			const deduplicateFragments = argv.deduplicateFragments ?? true

			const schemaFile = resolve(
				resolvedOutFile,
				`./schema.${gqlFileExtension}`,
			)
			const operationsFile = resolve(
				resolvedOutFile,
				`./operations.${gqlFileExtension}`,
			)

			const schema = printSchema(typeSchema).trim()

			const operations = await fetchGqlOperations(har)

			const validOperationDocuments = Array.from(
				operations.getValidOperations(!deduplicateFragments),
			)

			const operationSchema = printGqlOperations(
				validOperationDocuments.map(({ node }) => node),
			)

			await writeFile(schemaFile, schema)
			await writeFile(operationsFile, operationSchema)

			return
		}

		if (argv.gqlFileExtension) {
			console.warn(
				"`gql-file-extension` is only supported with `isolate-operations` and `split-operations`. Specify output extension directly in `out-file`.",
			)
		}

		let schema

		if (typesOnly) {
			schema = printSchema(typeSchema).trim()
		} else {
			const deduplicateFragments = argv.deduplicateFragments ?? true

			const operations = await fetchGqlOperations(har)

			const validOperationDocuments = Array.from(
				operations.getValidOperations(!deduplicateFragments),
			)

			schema = source`
				${printSchema(typeSchema)}

				${printGqlOperations(
					validOperationDocuments.map(({ node }) => node),
				)}
			`.trim()
		}

		await writeFile(resolvedOutFile, schema)
	},
})
