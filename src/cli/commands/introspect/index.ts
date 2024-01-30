import { fetchAccessToken } from "@s21toolkit/client"
import { command, option } from "cmd-ts"
import { NewFile } from "@/cli/arguments/types/NewFile"
import { fetchGqlSchema } from "@/common/fetch-gql-schema"
import { fetchStaticProperties } from "@/common/fetch-static-properties"

export const introspectCommand = command({
	name: "introspect",
	description: "Fetches GQL schema (requires authorization)",
	args: {
		username: option({
			long: "username",
			short: "u",
			description: "Platform account username",
		}),
		password: option({
			long: "password",
			short: "p",
			description: "Platform account password",
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

		const token = await fetchAccessToken(username, password)

		const [schema, staticProperties] = await Promise.all([
			fetchGqlSchema(token.accessToken),
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
