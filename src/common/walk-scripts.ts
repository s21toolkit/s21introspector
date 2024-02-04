import { Node, Options as ParserOptions, parse as parseProgram } from "acorn"
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

export type ScriptTraversalOptions = {
	parserOptions: ParserOptions
	visitedSources: Set<string>
}

export const DEFAULT_SCRIPT_TRAVERSAL_OPTIONS = {
	parserOptions: {
		ecmaVersion: "latest",
		sourceType: "module",
	},
	visitedSources: new Set(),
} satisfies ScriptTraversalOptions

function resolveTraversalOptions(
	partialOptions: Partial<ScriptTraversalOptions>,
): ScriptTraversalOptions {
	return {
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

	const webpageResponse = await fetch(webpageUrl)

	const webpageText = await webpageResponse.text()

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
	rootSource: string,
	callback: (program: Node, text: string, source: string) => void,
	partialTraversalOptions: Partial<ScriptTraversalOptions> = {},
) {
	const options = resolveTraversalOptions(partialTraversalOptions)

	const scriptQueue: string[] = [rootSource]

	const visitedSources = new Set(options.visitedSources)

	while (scriptQueue.length > 0) {
		const source = scriptQueue.shift()!

		if (visitedSources.has(source)) {
			continue
		}

		try {
			const scriptResponse = await fetch(source)

			const scriptText = await scriptResponse.text()

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
