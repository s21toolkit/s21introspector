import { Node } from "acorn"
import { simple as walkProgram } from "acorn-walk"
import { parse as parseGQL } from "graphql"
import { match, P } from "ts-pattern"

export function extractGqlLiterals(program: Node) {
	const gqlLiterals: string[] = []

	walkProgram(program, {
		Literal: (node) =>
			match(node).with(
				{
					value: P.string.minLength(1).select("value"),
				},
				({ value }) => {
					const trimmedValue = value.trim()

					if (trimmedValue.startsWith("{")) {
						return
					}

					try {
						parseGQL(value)

						gqlLiterals.push(value)
					} catch {}
				},
			),
	})

	return gqlLiterals
}
