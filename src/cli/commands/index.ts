import { subcommands } from "cmd-ts"
import { authCommand } from "./auth"
import { introspectCommand } from "./introspect"
import { sourcesCommand } from "./sources"
import { staticCommand } from "./static"
import { useS21CliAuthCommand } from "./use-s21cli-auth"

export const s21introspectorCommand = subcommands({
	name: "s21introspector",
	description: "GraphQL introspection utilities for school 21 edu platform",
	cmds: {
		introspect: introspectCommand,
		static: staticCommand,
		sources: sourcesCommand,
		auth: authCommand,
		"use-s21cli-auth": useS21CliAuthCommand,
	},
})
