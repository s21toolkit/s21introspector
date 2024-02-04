import { command } from "cmd-ts"
import { createInterface } from "node:readline"

function readLine() {
	return new Promise<string>((resolve) =>
		createInterface(process.stdin).on("line", (line) => resolve(line)),
	)
}

export const useS21CliAuthCommand = command({
	name: "use-s21-cli-auth",
	aliases: ["use-auth", "_"],
	description:
		"Takes `s21 auth` output from STDIN and converts it to --token option for introspector commands",
	args: {},
	async handler() {
		const tokenOutput = await readLine()

		const accessToken = tokenOutput.split(" ")[1]

		console.log(`--token ${accessToken}`)
	},
})
