import {
	DocumentNode,
	FragmentDefinitionNode,
	Kind,
	OperationDefinitionNode,
	parse,
	visit as walk,
} from "graphql"
import { createHash } from "node:crypto"
import { match, P } from "ts-pattern"

type Operation = {
	definition: OperationDefinitionNode
	fragmentReferences: Set<string>
}

export class OperationRegistry {
	#fragments = new Map<string, FragmentDefinitionNode>()
	#operations = new Map<string, Operation>()

	#addFragmentDefinition(definition: FragmentDefinitionNode) {
		this.#fragments.set(definition.name.value, definition)
	}

	#addOperationDefinition(definition: OperationDefinitionNode) {
		const name = match(definition)
			.with(
				{
					name: {
						kind: Kind.NAME,
						value: P.string.select("name"),
					},
				},
				({ name }) => name,
			)
			.otherwise((node) =>
				createHash("md5").update(JSON.stringify(node)).digest("hex"),
			)

		const fragmentReferences = new Set<string>()

		walk(definition, {
			FragmentSpread: (node) =>
				match(node).with(
					{
						kind: Kind.FRAGMENT_SPREAD,
						name: {
							kind: Kind.NAME,
							value: P.string.select("name"),
						},
					},
					({ name }) => {
						fragmentReferences.add(name)
					},
				),
		})

		this.#operations.set(name, {
			definition,
			fragmentReferences,
		})
	}

	addLiteral(literal: string) {
		let node

		try {
			node = parse(literal)
		} catch {
			return false
		}

		walk(node, {
			OperationDefinition: (node) => this.#addOperationDefinition(node),
			FragmentDefinition: (node) => this.#addFragmentDefinition(node),
		})

		return true
	}

	*getValidOperations(allowFragmentDuplication = true) {
		const yieldedFragments = new Set<string>()

		for (const [_name, operation] of this.#operations) {
			let fragmentReferences = Array.from(operation.fragmentReferences)

			if (!allowFragmentDuplication) {
				fragmentReferences = fragmentReferences.filter((fragment) =>
					yieldedFragments.has(fragment),
				)
			}

			const hasAllFragments = fragmentReferences.every((fragment) =>
				this.#fragments.has(fragment),
			)

			if (!hasAllFragments) {
				continue
			}

			const fragmentDefinitions = fragmentReferences.map(
				(fragment) => this.#fragments.get(fragment)!,
			)

			const node: DocumentNode = {
				kind: Kind.DOCUMENT,
				definitions: [...fragmentDefinitions, operation.definition],
			}

			for (const fragment of fragmentReferences) {
				yieldedFragments.add(fragment)
			}

			yield node
		}
	}
}
