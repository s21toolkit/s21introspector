import { fetchAccessToken } from "@s21toolkit/client"
import { command, flag, option, optional, string } from "cmd-ts"
import { source } from "common-tags"
import { printSchema } from "graphql"
import { resolve } from "node:path"
import { createInterface } from "node:readline"
import { NewFile } from "@/cli/arguments/types/NewFile"
import { extractGqlLiterals } from "@/common/extract-gql-literals"
import { fetchStaticProperties } from "@/common/fetch-static-properties"
import { fetchTypeSchema } from "@/common/fetch-type-schema"
import { walkScriptsFromWebpage } from "@/common/walk-scripts"
import { Constants } from "@/constants"

function readLine() {
	return new Promise<string>((resolve) =>
		createInterface(process.stdin).on("line", (line) => resolve(line)),
	)
}

async function resolveAccessToken(username?: string, password?: string) {
	if (!username && !password && !process.stdin.isTTY) {
		const input = await readLine()

		return input.split(" ")[1]!
	}

	if (username && password) {
		const token = await fetchAccessToken(username, password)

		return token.accessToken
	}

	throw new Error("Missing auth credentials")
}

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
		username: option({
			long: "username",
			short: "u",
			description:
				"Platform account username (required if stdin is not provided)",
			type: optional(string),
			defaultValue: () => undefined,
		}),
		password: option({
			long: "password",
			short: "p",
			description:
				"Platform account password (required if stdin is not provided)",
			type: optional(string),
			defaultValue: () => undefined,
		}),
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
		const { username, password, outFile, typesOnly } = argv

		const accessToken = await resolveAccessToken(username, password)

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
