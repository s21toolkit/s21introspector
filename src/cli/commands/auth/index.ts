import { fetchAccessToken } from "@s21toolkit/client"
import { command, flag, positional } from "cmd-ts"

export const authCommand = command({
	name: "auth",
	description: "Fetches platform access token for a given user",
	args: {
		username: positional({
			displayName: "username",
			description: "Platform account username",
		}),
		password: positional({
			displayName: "password",
			description: "Platform account password",
		}),
		noFlag: flag({
			short: "f",
			long: "no-flag",
			description: "Don't prepend --token flag to the output",
			defaultValue: () => false,
		}),
	},
	async handler(argv) {
		const { username, password, noFlag } = argv

		const token = await fetchAccessToken(username, password)

		const flagPrefix = noFlag ? "" : "--token "

		console.log(`${flagPrefix}${token.accessToken}`)
	},
})
