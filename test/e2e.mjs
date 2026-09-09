import assert from 'node:assert/strict';

import { MongoClient } from 'mongodb';

import { DocumentDb } from '../dist/nodes/DocumentDb/DocumentDb.node.js';

const connectionString = process.env.DOCUMENTDB_CONNECTION_STRING;
const database = process.env.DOCUMENTDB_DATABASE;

if (!connectionString || !database) {
	throw new Error('DOCUMENTDB_CONNECTION_STRING and DOCUMENTDB_DATABASE are required');
}

const credentials = {
	configurationType: 'connectionString',
	connectionString,
	database,
};
const collection = `n8n_e2e_${Date.now()}`;
const node = new DocumentDb();
const testNode = {
	id: 'documentdb-e2e',
	name: 'DocumentDB E2E',
	type: 'n8n-nodes-documentdb.documentDb',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

function context(parameters, input = [{ json: {} }], continueOnFail = false) {
	return {
		getInputData: () => input,
		getCredentials: async () => credentials,
		getNode: () => testNode,
		continueOnFail: () => continueOnFail,
		getNodeParameter(name, itemIndex, defaultValue) {
			const value = parameters[name];
			if (typeof value === 'function') return value(itemIndex);
			return value === undefined ? defaultValue : value;
		},
	};
}

async function execute(parameters, input, continueOnFail) {
	return node.execute.call(context(parameters, input, continueOnFail));
}

function outputJson(result) {
	return result[0].map((item) => item.json);
}

async function expectRejected(operation, expectedMessage) {
	await assert.rejects(operation, (error) => {
		assert.match(error.message, expectedMessage);
		return true;
	});
}

const cleanupClient = new MongoClient(connectionString);

try {
	const credentialResult = await node.methods.credentialTest.testConnection.call(
		{},
		{
			data: credentials,
		},
	);
	assert.equal(credentialResult.status, 'OK', credentialResult.message);

	const inserted = outputJson(
		await execute(
			{
				operation: 'insert',
				collection,
				document: (index) => ({
					externalId: `item-${index + 1}`,
					category: index === 0 ? 'alpha' : 'beta',
					sequence: index + 1,
					status: 'new',
				}),
			},
			[{ json: {} }, { json: {} }],
		),
	);
	assert.equal(inserted.length, 2);
	assert.ok(inserted.every((item) => typeof item._id === 'string'));

	const databases = outputJson(await execute({ operation: 'listDatabases' }));
	assert.ok(databases.some((item) => item.name === database));

	const collections = outputJson(await execute({ operation: 'listCollections' }));
	assert.ok(collections.some((item) => item.name === collection));

	const found = outputJson(
		await execute({
			operation: 'find',
			collection,
			filter: {},
			options: {
				projection: { _id: 0, externalId: 1, sequence: 1 },
				sort: { sequence: -1 },
				skip: 0,
				limit: 1,
			},
		}),
	);
	assert.deepEqual(found, [{ externalId: 'item-2', sequence: 2 }]);

	const updated = outputJson(
		await execute({
			operation: 'update',
			collection,
			filter: { externalId: 'item-1' },
			update: { $set: { status: 'updated' } },
			updateMany: false,
		}),
	)[0];
	assert.equal(updated.matchedCount, 1);
	assert.equal(updated.modifiedCount, 1);

	const aggregated = outputJson(
		await execute({
			operation: 'aggregate',
			collection,
			pipeline: [
				{ $match: { status: 'updated' } },
				{ $group: { _id: '$status', count: { $sum: 1 } } },
			],
		}),
	);
	assert.deepEqual(aggregated, [{ _id: 'updated', count: 1 }]);

	await expectRejected(
		() =>
			execute({
				operation: 'update',
				collection,
				filter: {},
				update: { $set: { unsafe: true } },
				updateMany: true,
			}),
		/Filter cannot be empty when Update All Matches is enabled/,
	);

	await expectRejected(
		() => execute({ operation: 'delete', collection, filter: {}, deleteMany: true }),
		/Filter cannot be empty when Delete All Matches is enabled/,
	);

	const deletedOne = outputJson(
		await execute({
			operation: 'delete',
			collection,
			filter: { externalId: 'item-1' },
			deleteMany: false,
		}),
	)[0];
	assert.equal(deletedOne.deletedCount, 1);

	const deletedMany = outputJson(
		await execute({
			operation: 'delete',
			collection,
			filter: { category: 'beta' },
			deleteMany: true,
		}),
	)[0];
	assert.equal(deletedMany.deletedCount, 1);

	const remaining = outputJson(
		await execute({ operation: 'find', collection, filter: {}, options: { limit: 50 } }),
	);
	assert.equal(remaining.length, 0);

	console.log('DocumentDB E2E passed: credential, discovery, CRUD, aggregate, and safety checks');
} finally {
	await cleanupClient.connect();
	await cleanupClient
		.db(database)
		.collection(collection)
		.drop()
		.catch(() => undefined);
	await cleanupClient.close();
}
