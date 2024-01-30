import { subcommands } from "cmd-ts"
import { introspectCommand } from "./introspect"
import { sourcesCommand } from "./sources"
import { staticCommand } from "./static"

export const s21introspectorCommand = subcommands({
	name: "s21introspector",
	description: "GraphQL introspection utilities for school 21 edu platform",
	cmds: {
		introspect: introspectCommand,
		static: staticCommand,
		sources: sourcesCommand,
	},
})
