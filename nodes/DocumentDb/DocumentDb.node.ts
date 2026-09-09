import type {
	Filter,
	OptionalUnlessRequiredId,
	Sort,
	UpdateFilter,
} from 'mongodb';
import type {
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	IDataObject,
	IExecuteFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	createClient,
	parseObject,
	parsePipeline,
	requireDatabase,
	sanitizeError,
	toJson,
} from './GenericFunctions';

export class DocumentDb implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DocumentDB',
		name: 'documentDb',
		icon: { light: 'file:documentdb.svg', dark: 'file:documentdb.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read and write data in Azure DocumentDB and compatible deployments',
		defaults: { name: 'DocumentDB' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'documentDbApi', required: true, testedBy: 'testConnection' }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Collection', value: 'collection' },
					{ name: 'Database', value: 'database' },
					{ name: 'Document', value: 'document' },
				],
				default: 'document',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['database'] } },
				options: [{ name: 'List', value: 'listDatabases', action: 'List databases' }],
				default: 'listDatabases',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['collection'] } },
				options: [{ name: 'List', value: 'listCollections', action: 'List collections' }],
				default: 'listCollections',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['document'] } },
				options: [
					{ name: 'Aggregate', value: 'aggregate', action: 'Aggregate documents' },
					{ name: 'Delete', value: 'delete', action: 'Delete documents' },
					{ name: 'Find', value: 'find', action: 'Find documents' },
					{ name: 'Insert', value: 'insert', action: 'Insert a document' },
					{ name: 'Update', value: 'update', action: 'Update documents' },
				],
				default: 'find',
			},
			{
				displayName: 'Collection',
				name: 'collection',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { resource: ['document'] } },
				description: 'Name of the collection',
			},
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'json',
				default: '{}',
				required: true,
				displayOptions: { show: { operation: ['find', 'update', 'delete'] } },
				description: 'MongoDB-compatible filter as a JSON object',
			},
			{
				displayName: 'Document',
				name: 'document',
				type: 'json',
				default: '={{$json}}',
				required: true,
				displayOptions: { show: { operation: ['insert'] } },
				description: 'Document to insert as a JSON object',
			},
			{
				displayName: 'Update',
				name: 'update',
				type: 'json',
				default: '{"$set": {}}',
				required: true,
				displayOptions: { show: { operation: ['update'] } },
				description: 'MongoDB-compatible update operators as a JSON object',
			},
			{
				displayName: 'Pipeline',
				name: 'pipeline',
				type: 'json',
				default: '[]',
				required: true,
				displayOptions: { show: { operation: ['aggregate'] } },
				description: 'MongoDB-compatible aggregation pipeline as a JSON array',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: { show: { operation: ['find'] } },
				options: [
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 50,
						description: 'Max number of results to return',
					},
					{
						displayName: 'Projection',
						name: 'projection',
						type: 'json',
						default: '{}',
						description: 'Fields to include or exclude as a JSON object',
					},
					{
						displayName: 'Skip',
						name: 'skip',
						type: 'number',
						typeOptions: { minValue: 0 },
						default: 0,
					},
					{
						displayName: 'Sort',
						name: 'sort',
						type: 'json',
						default: '{}',
						description: 'Sort order as a JSON object, for example {"createdAt": -1}',
					},
				],
			},
			{
				displayName: 'Update All Matches',
				name: 'updateMany',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['update'] } },
				description: 'Whether to update every matching document instead of only the first',
			},
			{
				displayName: 'Delete All Matches',
				name: 'deleteMany',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['delete'] } },
				description: 'Whether to delete every matching document instead of only the first',
			},
		],
	};

	methods = {
		credentialTest: {
			async testConnection(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				if (!credential.data) {
					return { status: 'Error', message: 'Credential data is missing' };
				}
				let client: ReturnType<typeof createClient> | undefined;
				try {
					client = createClient(credential.data);
					await client.connect();
					await client.db('admin').command({ ping: 1 });
					return { status: 'OK', message: 'Connection successful' };
				} catch (error) {
					return { status: 'Error', message: sanitizeError(error) };
				} finally {
					await client?.close().catch(() => undefined);
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputItems = this.getInputData();
		const credentials = await this.getCredentials('documentDbApi');
		const operation = this.getNodeParameter('operation', 0) as string;
		let client: ReturnType<typeof createClient> | undefined;
		const returnData: INodeExecutionData[] = [];

		try {
			client = createClient(credentials);
			await client.connect();
			if (operation === 'listDatabases') {
				const result = await client.db('admin').admin().listDatabases();
				return [
					result.databases.map((database) => ({
						json: toJson(database),
						pairedItem: { item: 0 },
					})),
				];
			}

			const databaseName = requireDatabase(this.getNode(), credentials);
			const database = client.db(databaseName);
			if (operation === 'listCollections') {
				const collections = await database.listCollections({}, { nameOnly: true }).toArray();
				return [
					collections.map((collection) => ({
						json: toJson(collection),
						pairedItem: { item: 0 },
					})),
				];
			}

			for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex++) {
				try {
					const collectionName = String(this.getNodeParameter('collection', itemIndex)).trim();
					if (!collectionName) {
						throw new NodeOperationError(this.getNode(), 'Collection is required', { itemIndex });
					}
					const collection = database.collection(collectionName);
					let results: IDataObject[] = [];

					if (operation === 'find') {
						const filter = parseObject(
							this.getNode(),
							this.getNodeParameter('filter', itemIndex),
							'Filter',
						) as Filter<IDataObject>;
						const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
						let cursor = collection.find(filter);
						if (options.projection) {
							cursor = cursor.project(parseObject(this.getNode(), options.projection, 'Projection'));
						}
						if (options.sort) {
							cursor = cursor.sort(parseObject(this.getNode(), options.sort, 'Sort') as Sort);
						}
						if (Number(options.skip) > 0) cursor = cursor.skip(Number(options.skip));
						if (Number(options.limit) > 0) cursor = cursor.limit(Number(options.limit));
						results = (await cursor.toArray()).map(toJson);
					} else if (operation === 'insert') {
						const document = parseObject(
							this.getNode(),
							this.getNodeParameter('document', itemIndex),
							'Document',
						);
						const result = await collection.insertOne(document as OptionalUnlessRequiredId<IDataObject>);
						results = [{ ...toJson(document), _id: result.insertedId.toString() }];
					} else if (operation === 'update') {
						const filter = parseObject(
							this.getNode(),
							this.getNodeParameter('filter', itemIndex),
							'Filter',
						) as Filter<IDataObject>;
						const update = parseObject(
							this.getNode(),
							this.getNodeParameter('update', itemIndex),
							'Update',
						) as UpdateFilter<IDataObject>;
						if (!Object.keys(update).some((key) => key.startsWith('$'))) {
							throw new NodeOperationError(this.getNode(), 'Update must contain an update operator such as $set', { itemIndex });
						}
						const updateMany = this.getNodeParameter('updateMany', itemIndex) as boolean;
						if (updateMany && Object.keys(filter).length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								'Filter cannot be empty when Update All Matches is enabled',
								{ itemIndex },
							);
						}
						const result = updateMany
							? await collection.updateMany(filter, update)
							: await collection.updateOne(filter, update);
						results = [toJson({ acknowledged: result.acknowledged, matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, upsertedId: result.upsertedId })];
					} else if (operation === 'delete') {
						const filter = parseObject(
							this.getNode(),
							this.getNodeParameter('filter', itemIndex),
							'Filter',
						) as Filter<IDataObject>;
						const deleteMany = this.getNodeParameter('deleteMany', itemIndex) as boolean;
						if (deleteMany && Object.keys(filter).length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								'Filter cannot be empty when Delete All Matches is enabled',
								{ itemIndex },
							);
						}
						const result = deleteMany
							? await collection.deleteMany(filter)
							: await collection.deleteOne(filter);
						results = [toJson({ acknowledged: result.acknowledged, deletedCount: result.deletedCount })];
					} else if (operation === 'aggregate') {
						const pipeline = parsePipeline(
							this.getNode(),
							this.getNodeParameter('pipeline', itemIndex),
						);
						results = (await collection.aggregate(pipeline).toArray()).map(toJson);
					}

					returnData.push(...results.map((json) => ({ json, pairedItem: { item: itemIndex } })));
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({ json: { error: sanitizeError(error) }, pairedItem: { item: itemIndex } });
						continue;
					}
					throw new NodeOperationError(this.getNode(), sanitizeError(error), { itemIndex });
				}
			}
		} catch (error) {
			throw new NodeOperationError(this.getNode(), sanitizeError(error));
		} finally {
			await client?.close().catch(() => undefined);
		}

		return [returnData];
	}
}