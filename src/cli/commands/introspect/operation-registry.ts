import { createHash } from "node:crypto"
import {
	type DefinitionNode,
	type DocumentNode,
	type FragmentDefinitionNode,
	Kind,
	type OperationDefinitionNode,
	parse,
	visit as walk,
} from "graphql"
import { match, P } from "ts-pattern"

// TODO: Refactor this

type DefinitionRecord<TDefinition extends DefinitionNode> = {
	definition: TDefinition
	fragmentReferences: Set<string>
}

function extractDirectFragmentReferences(definition: DefinitionNode) {
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
				({ name }) => fragmentReferences.add(name),
			),
	})

	return fragmentReferences
}

export class OperationRegistry {
	#fragments = new Map<string, DefinitionRecord<FragmentDefinitionNode>>()
	#operations = new Map<string, DefinitionRecord<OperationDefinitionNode>>()

	#addFragmentDefinition(definition: FragmentDefinitionNode) {
		if (this.#fragments.has(definition.name.value)) {
			console.log(`Fragment found: [duplicate] ${definition.name.value}`)

			return
		}

		console.log(`Fragment found: ${definition.name.value}`)

		const fragmentReferences = extractDirectFragmentReferences(definition)

		this.#fragments.set(definition.name.value, {
			definition,
			fragmentReferences,
		})
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

		if (this.#operations.has(name)) {
			console.log(`Operation found: [duplicate] ${name}`)

			return
		}

		console.log(`Operation found: ${name}`)

		const fragmentReferences = extractDirectFragmentReferences(definition)

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
			console.log(`Literal discarded: ${literal}`)
			return false
		}

		walk(node, {
			OperationDefinition: (node) => this.#addOperationDefinition(node),
			FragmentDefinition: (node) => this.#addFragmentDefinition(node),
		})

		return true
	}

	#resolveFragmentReferences(record: DefinitionRecord<DefinitionNode>) {
		const fragmentQueue = Array.from(record.fragmentReferences)
		const resolvedFragments = new Set<string>()

		while (fragmentQueue.length > 0) {
			// biome-ignore lint/style/noNonNullAssertion: length already checked
			const fragment = fragmentQueue.shift()!

			if (resolvedFragments.has(fragment)) {
				continue
			}

			const directReferences =
				// biome-ignore lint/style/noNonNullAssertion: expected to be non-null
				this.#fragments.get(fragment)!.fragmentReferences

			fragmentQueue.push(...directReferences)

			resolvedFragments.add(fragment)
		}

		return resolvedFragments
	}

	*getValidOperations(allowFragmentDuplication = true) {
		const yieldedFragments = new Set<string>()

		for (const [name, operation] of this.#operations) {
			let fragmentReferences = Array.from(
				this.#resolveFragmentReferences(operation),
			)

			if (!allowFragmentDuplication) {
				const duplicatedFragments = fragmentReferences.filter((fragment) =>
					yieldedFragments.has(fragment),
				)

				if (duplicatedFragments.length > 0) {
					console.log(
						`Discarded duplicated fragments: ${duplicatedFragments.join(
							", ",
						)}`,
					)
				}

				fragmentReferences = fragmentReferences.filter(
					(fragment) => !yieldedFragments.has(fragment),
				)
			}

			const hasAllFragments = fragmentReferences.every((fragment) =>
				this.#fragments.has(fragment),
			)

			if (!hasAllFragments) {
				console.log(
					`Invalid operation: ${name} ${
						fragmentReferences.length > 0
							? `<- [present] ${fragmentReferences
									.filter((fragment) => this.#fragments.has(fragment))
									.join(", ")} [missing] ${fragmentReferences
									.filter((fragment) => !this.#fragments.has(fragment))
									.join(", ")}`
							: ""
					}`,
				)

				continue
			}

			const fragmentDefinitions = fragmentReferences
				// biome-ignore lint/style/noNonNullAssertion: expected to be non-null
				.map((fragment) => this.#fragments.get(fragment)!.definition)
				.toReversed()

			const node: DocumentNode = {
				kind: Kind.DOCUMENT,
				definitions: [...fragmentDefinitions, operation.definition],
			}

			for (const fragment of fragmentReferences) {
				yieldedFragments.add(fragment)
			}

			console.log(
				`Extracting operation: ${name} ${
					fragmentReferences.length > 0
						? `<- ${fragmentReferences.join(", ")}`
						: ""
				}`,
			)

			yield { name, node }
		}
	}
}
