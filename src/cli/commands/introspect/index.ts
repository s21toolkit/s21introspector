import { fetchAccessToken } from "@s21toolkit/client"
import { command, option, optional, string } from "cmd-ts"
import { createInterface } from "node:readline"
import { NewFile } from "@/cli/arguments/types/NewFile"
import { fetchGqlSchema } from "@/common/fetch-gql-schema"
import { fetchStaticProperties } from "@/common/fetch-static-properties"

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

export const introspectCommand = command({
	name: "introspect",
	description: "Fetches GQL schema (requires authorization)",
	args: {
		username: option({
			long: "username",
			short: "u",
			description: "Platform account username",
			type: optional(string),
			defaultValue: () => "",
		}),
		password: option({
			long: "password",
			short: "p",
			description: "Platform account password",
			type: optional(string),
			defaultValue: () => "",
		}),
		outFile: option({
			type: NewFile,
			long: "out-file",
			short: "o",
			description:
				"Output schema file (supports {substitutions} for static properties)",
			defaultValue: () => "schema_{PRODUCT_VERSION}.graphql",
		}),
	},
	async handler(argv) {
		const { username, password, outFile } = argv

		const token = await resolveAccessToken(username, password)

		const [schema, staticProperties] = await Promise.all([
			fetchGqlSchema(token),
			fetchStaticProperties(),
		])

		const resolvedOutFile = outFile.replaceAll(
			/{(?<placeholder>[\w\d_$-]+)}/g,
			(_match, placeholder) => {
				return staticProperties.get(placeholder) ?? ""
			},
		)

		await Bun.write(resolvedOutFile, schema)
	},
})
