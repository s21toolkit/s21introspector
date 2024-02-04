import { option } from "cmd-ts"

export const PLATFORM_TOKEN = {
	accessToken: option({
		long: "token",
		short: "t",
		description: "Platform account access token",
	}),
}
