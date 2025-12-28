import { source } from "common-tags"
import { buildClientSchema, type IntrospectionQuery } from "graphql"
import { Constants } from "@/constants"

const INTROSPECTION_QUERY = source`
	{
		__schema {
			types {
				kind
				name
				description
				fields(includeDeprecated: true) {
					name
					description
					isDeprecated
					deprecationReason
					type {
						kind
						name
						description
						ofType {
							kind
							name
							description
							ofType {
								kind
								name
								description
								ofType {
									kind
									name
									description
									ofType {
										kind
										name
										description
										ofType {
											kind
											name
											description
											ofType {
												kind
												name
												description
												ofType {
													kind
													name
													description
												}
											}
										}
									}
								}
							}
						}
					}
					args {
						name
						description
						type {
							kind
							name
							description
							ofType {
								kind
								name
								description
								ofType {
									kind
									name
									description
									ofType {
										kind
										name
										description
										ofType {
											kind
											name
											description
											ofType {
												kind
												name
												description
												ofType {
													kind
													name
													description
													ofType {
														kind
														name
														description
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
				interfaces {
					kind
					name
					description
					ofType {
						kind
						name
						description
						ofType {
							kind
							name
							description
							ofType {
								kind
								name
								description
								ofType {
									kind
									name
									description
									ofType {
										kind
										name
										description
										ofType {
											kind
											name
											description
											ofType {
												kind
												name
												description
											}
										}
									}
								}
							}
						}
					}
				}
				possibleTypes {
					kind
					name
					description
					ofType {
						kind
						name
						description
						ofType {
							kind
							name
							description
							ofType {
								kind
								name
								description
								ofType {
									kind
									name
									description
									ofType {
										kind
										name
										description
										ofType {
											kind
											name
											description
											ofType {
												kind
												name
												description
											}
										}
									}
								}
							}
						}
					}
				}
				enumValues(includeDeprecated: true) {
					name
					description
				}
				inputFields {
					name
					description
					type {
						kind
						name
						description
						ofType {
							kind
							name
							description
							ofType {
								kind
								name
								description
								ofType {
									kind
									name
									description
									ofType {
										kind
										name
										description
										ofType {
											kind
											name
											description
											ofType {
												kind
												name
												description
												ofType {
													kind
													name
													description
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
			subscriptionType {
				name
				description
			}
			directives {
				name
				description
				locations
				args {
					name
					description
					type {
						kind
						name
						description
						ofType {
							kind
							name
							description
							ofType {
								kind
								name
								description
								ofType {
									kind
									name
									description
									ofType {
										kind
										name
										description
										ofType {
											kind
											name
											description
											ofType {
												kind
												name
												description
												ofType {
													kind
													name
													description
												}
											}
										}
									}
								}
							}
						}
					}
					defaultValue
				}
			}
		}
	}
`

export async function fetchTypeSchema(accessToken: string) {
	const introspectionResponse = await fetch(Constants.Platform.GQL_URL, {
		method: "POST",
		body: JSON.stringify({
			query: INTROSPECTION_QUERY,
		}),
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken}`,
		},
	})

	const { data: introspection } = (await introspectionResponse.json()) as {
		data: IntrospectionQuery
	}

	const schema = buildClientSchema(introspection)

	return schema
}
