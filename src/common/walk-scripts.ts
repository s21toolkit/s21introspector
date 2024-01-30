import { Node, Options, parse as parseProgram } from "acorn"
import { simple as walkProgram } from "acorn-walk"
import { parse as parseHtmlDocument } from "node-html-parser"
import { match, P } from "ts-pattern"

function resolveSource(base: string, url: string) {
	return new URL(url, base).href
}

function extractDynamicImports(program: Node) {
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
	})

	return importSources
}

export async function walkScripts(
	webpageUrl: string,
	callback: (program: Node, text: string, source: string) => void,
	parserOptions: Options = { ecmaVersion: "latest", sourceType: "module" },
) {
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
			const program = parseProgram(text, parserOptions)

			const importSources = extractDynamicImports(program)

			scriptQueue.push(
				...importSources.map((importSource) =>
					resolveSource(webpageUrl, importSource),
				),
			)

			callback(program, text, webpageUrl)
		}
	}

	const visitedSources = new Set<string>()

	while (scriptQueue.length > 0) {
		const source = scriptQueue.shift()!

		if (visitedSources.has(source)) {
			continue
		}

		try {
			const scriptResponse = await fetch(source)

			const scriptText = await scriptResponse.text()

			const program = parseProgram(scriptText, parserOptions)

			const importSources = extractDynamicImports(program)

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
}
