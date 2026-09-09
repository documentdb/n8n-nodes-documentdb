import { MongoClient, type Document } from 'mongodb';
import type { ICredentialDataDecryptedObject, IDataObject, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export function getConnectionString(credentials: ICredentialDataDecryptedObject): string {
	if (credentials.configurationType === 'connectionString') {
		const connectionString = String(credentials.connectionString ?? '').trim();
		if (!/^mongodb(?:\+srv)?:\/\//i.test(connectionString)) {
			throw new Error('Connection String must start with mongodb:// or mongodb+srv://');
		}
		return connectionString;
	}

	const host = String(credentials.host ?? '').trim();
	const user = String(credentials.user ?? '').trim();
	const password = String(credentials.password ?? '');
	const authSource = String(credentials.authSource ?? 'admin').trim();
	const port = Number(credentials.port);

	if (!host || !user || !authSource || !Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error('Host, user, authentication database, and a valid port are required');
	}

	const authentication = `${encodeURIComponent(user)}:${encodeURIComponent(password)}@`;
	const parameters = new URLSearchParams({
		authSource,
		tls: String(credentials.tls !== false),
	});
	return `mongodb://${authentication}${host}:${port}/?${parameters.toString()}`;
}

export function createClient(credentials: ICredentialDataDecryptedObject): MongoClient {
	return new MongoClient(getConnectionString(credentials), {
		appName: 'n8n-nodes-documentdb',
		serverSelectionTimeoutMS: 10000,
	});
}

export function requireDatabase(
	node: INode,
	credentials: ICredentialDataDecryptedObject,
): string {
	const database = String(credentials.database ?? '').trim();
	if (!database) {
		throw new NodeOperationError(node, 'Set Default Database in the DocumentDB credential');
	}
	return database;
}

export function parseObject(node: INode, value: unknown, parameterName: string): Document {
	let parsed = value;
	if (typeof value === 'string') {
		try {
			parsed = JSON.parse(value);
		} catch (error) {
			throw new NodeOperationError(node, `${parameterName} must contain valid JSON`, {
				description: error instanceof Error ? error.message : undefined,
			});
		}
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new NodeOperationError(node, `${parameterName} must be a JSON object`);
	}
	return parsed as Document;
}

export function parsePipeline(node: INode, value: unknown): Document[] {
	let parsed = value;
	if (typeof value === 'string') {
		try {
			parsed = JSON.parse(value);
		} catch (error) {
			throw new NodeOperationError(node, 'Pipeline must contain valid JSON', {
				description: error instanceof Error ? error.message : undefined,
			});
		}
	}
	if (
		!Array.isArray(parsed) ||
		parsed.some((stage) => !stage || typeof stage !== 'object' || Array.isArray(stage))
	) {
		throw new NodeOperationError(node, 'Pipeline must be a JSON array of objects');
	}
	return parsed as Document[];
}

export function toJson(value: unknown): IDataObject {
	return JSON.parse(JSON.stringify(value)) as IDataObject;
}

export function sanitizeError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message.replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, 'mongodb://[REDACTED]');
}