import { Constants } from "@/constants"
import { parse } from "acorn"
import { simple as walk } from "acorn-walk"
import { P, match } from "ts-pattern"

export async function fetchStaticProperties() {
	const staticScriptResponse = await fetch(
		Constants.Platform.STATIC_SCRIPT_URL,
	)

	const staticScript = await staticScriptResponse.text()

	const program = parse(staticScript, {
		ecmaVersion: "latest",
	})

	const properties = new Map<string, string>()

	walk(program, {
		AssignmentExpression: (node) =>
			match(node).with(
				{
					left: {
						type: "MemberExpression",
						object: { type: "Identifier", name: "window" },
						property: {
							type: "Identifier",
							name: P.string.select("property"),
						},
					},
					right: {
						type: "LogicalExpression",
						left: {
							type: "Literal",
							value: P.string.select("value"),
						},
						right: {
							type: "Identifier",
							name: "undefined",
						},
					},
				},
				({ property, value }) => {
					properties.set(property, value)
				},
			),
	})

	return properties
}
