import {
	type Node,
	type Options as ParserOptions,
	parse as parseProgram,
} from "acorn"
import { simple as walkProgram } from "acorn-walk"
import { parse as parseHtmlDocument } from "node-html-parser"
import { match, P } from "ts-pattern"

function resolveSource(base: string, url: string) {
	return new URL(url, base).href
}

function extractImports(program: Node) {
	const importSources: string[] = []

	walkProgram(program, {
		ImportExpression: (node) =>
			match(node).with(
				{
					source: {
						type: "Literal",
						value: P.string.endsWith(".js").select("source"),
					},
				},
				({ source }) => {
					importSources.push(source)
				},
			),
		ImportDeclaration: (node) =>
			match(node).with(
				{
					source: {
						type: "Literal",
						value: P.string.endsWith(".js").select("source"),
					},
				},
				({ source }) => {
					importSources.push(source)
				},
			),
	})

	return importSources
}

export type DocumentLoader = (url: string) => Promise<string>

export type ScriptTraversalOptions = {
	parserOptions: ParserOptions
	visitedSources: Set<string>
	fetchText: DocumentLoader
}

export const fetchText: DocumentLoader = (url) =>
	fetch(url).then((response) => response.text())

export const DEFAULT_SCRIPT_TRAVERSAL_OPTIONS = {
	parserOptions: {
		ecmaVersion: "latest",
		sourceType: "module",
	},
	visitedSources: new Set(),
	fetchText,
} satisfies ScriptTraversalOptions

function resolveTraversalOptions(
	partialOptions: Partial<ScriptTraversalOptions>,
): ScriptTraversalOptions {
	return {
		...DEFAULT_SCRIPT_TRAVERSAL_OPTIONS,
		parserOptions: {
			...DEFAULT_SCRIPT_TRAVERSAL_OPTIONS.parserOptions,
			...(partialOptions.parserOptions ?? {}),
		},
		visitedSources: new Set([
			...DEFAULT_SCRIPT_TRAVERSAL_OPTIONS.visitedSources,
			...(partialOptions.visitedSources ?? []),
		]),
	}
}

export async function walkScriptsFromWebpage(
	webpageUrl: string,
	callback: (program: Node, text: string, source: string) => void,
	partialTraversalOptions: Partial<ScriptTraversalOptions> = {},
) {
	const options = resolveTraversalOptions(partialTraversalOptions)

	const webpageText = await options.fetchText(webpageUrl)

	const document = parseHtmlDocument(webpageText)

	const scriptTags = document.querySelectorAll("script")

	const scriptQueue: string[] = []

	for (const scriptTag of scriptTags) {
		const source = scriptTag.getAttribute("src")
		const text = scriptTag.text

		if (source) {
			scriptQueue.push(resolveSource(webpageUrl, source))
		} else {
			const program = parseProgram(text, options.parserOptions)

			const importSources = extractImports(program)

			scriptQueue.push(
				...importSources.map((importSource) =>
					resolveSource(webpageUrl, importSource),
				),
			)

			callback(program, text, webpageUrl)
		}
	}

	const visitedSources = new Set(options.visitedSources)

	while (scriptQueue.length > 0) {
		// biome-ignore lint/style/noNonNullAssertion: length already checked
		const source = scriptQueue.shift()!

		if (visitedSources.has(source)) {
			continue
		}

		const visitedImports = await walkScriptsFromScript(source, callback, {
			parserOptions: options.parserOptions,
			visitedSources,
		})

		for (const source of visitedImports) {
			visitedSources.add(source)
		}
	}

	return visitedSources
}

export async function walkScriptsFromScript(
	scriptUrl: string,
	callback: (program: Node, text: string, source: string) => void,
	partialTraversalOptions: Partial<ScriptTraversalOptions> = {},
) {
	const options = resolveTraversalOptions(partialTraversalOptions)

	const scriptQueue: string[] = [scriptUrl]

	const visitedSources = new Set(options.visitedSources)

	while (scriptQueue.length > 0) {
		// biome-ignore lint/style/noNonNullAssertion: length already checked
		const source = scriptQueue.shift()!

		if (visitedSources.has(source)) {
			continue
		}

		try {
			const scriptText = await options.fetchText(source)

			const program = parseProgram(scriptText, options.parserOptions)

			const importSources = extractImports(program)

			scriptQueue.push(
				...importSources.map((importSource) =>
					resolveSource(source, importSource),
				),
			)

			callback(program, scriptText, source)
		} catch (error) {
			console.error(`Script traversal failed: ${source}\n`, error)
		}

		visitedSources.add(source)
	}

	return visitedSources
}
