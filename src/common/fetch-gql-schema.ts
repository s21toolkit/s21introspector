import { source } from "common-tags"
import { printSchema } from "graphql"
import { Constants } from "@/constants"
import { extractGqlLiterals } from "./extract-gql-literals"
import { fetchTypeSchema } from "./fetch-type-schema"
import { walkScriptsFromWebpage } from "./walk-scripts"

export async function fetchGqlSchema(accessToken: string) {
	const gqlLiterals: string[] = []

	const walkScriptsPromise = walkScriptsFromWebpage(
		Constants.Platform.BASE_URL,
		(program) => {
			gqlLiterals.push(...extractGqlLiterals(program))
		},
	)

	const typeSchemaPromise = fetchTypeSchema(accessToken)

	const [, typeSchema] = await Promise.all([
		walkScriptsPromise,
		typeSchemaPromise,
	])

	const schema = source`
		${printSchema(typeSchema)}

		${gqlLiterals.reduce((a, b) => `${a.trim()}\n\n${b.trim()}`)}
	`

	return schema
}
