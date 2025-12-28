import type { Node } from "acorn"
import { simple as walkProgram } from "acorn-walk"
import { parse as parseGQL } from "graphql"
import { match, P } from "ts-pattern"

export function extractGqlLiterals(program: Node) {
	const gqlLiterals: string[] = []

	function tryCollectGqlLiteral(literal: string) {
		const trimmedValue = literal.trim()

		if (trimmedValue.startsWith("{")) {
			return
		}

		try {
			parseGQL(literal)

			gqlLiterals.push(literal)
		} catch {}
	}

	walkProgram(program, {
		Literal: (node) =>
			match(node).with(
				{
					value: P.string.minLength(1).select("value"),
				},
				({ value }) => tryCollectGqlLiteral(value),
			),
		TemplateElement: (node) =>
			match(node).with(
				{
					type: "TemplateElement",
					value: {
						cooked: P.string.select("value"),
					},
				},
				({ value }) => tryCollectGqlLiteral(value),
			),
	})

	return gqlLiterals
}
