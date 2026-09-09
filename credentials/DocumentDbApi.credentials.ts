import type { Icon, ICredentialType, INodeProperties } from 'n8n-workflow';

export class DocumentDbApi implements ICredentialType {
	name = 'documentDbApi';

	displayName = 'DocumentDB API';

	icon: Icon = {
		light: 'file:../nodes/DocumentDb/documentdb.svg',
		dark: 'file:../nodes/DocumentDb/documentdb.dark.svg',
	};

	documentationUrl = 'https://learn.microsoft.com/en-us/azure/documentdb/how-to-connect-drivers';

	properties: INodeProperties[] = [
		{
			displayName: 'Configuration Type',
			name: 'configurationType',
			type: 'options',
			options: [
				{ name: 'Connection String', value: 'connectionString' },
				{ name: 'Connection Values', value: 'values' },
			],
			default: 'connectionString',
		},
		// A connection string contains the database password.
		// eslint-disable-next-line @n8n/community-nodes/credential-unnecessary-password
		{
			displayName: 'Connection String',
			name: 'connectionString',
			type: 'string',
			typeOptions: { password: true },
			displayOptions: { show: { configurationType: ['connectionString'] } },
			default: '',
			placeholder: 'mongodb://user:password@host:10260/?tls=true&authSource=admin',
			description: 'MongoDB-compatible connection string supplied by DocumentDB',
			required: true,
		},
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			displayOptions: { show: { configurationType: ['values'] } },
			default: 'localhost',
			required: true,
		},
		{
			displayName: 'Port',
			name: 'port',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 65535 },
			displayOptions: { show: { configurationType: ['values'] } },
			default: 10260,
			required: true,
		},
		{
			displayName: 'User',
			name: 'user',
			type: 'string',
			displayOptions: { show: { configurationType: ['values'] } },
			default: '',
			required: true,
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			displayOptions: { show: { configurationType: ['values'] } },
			default: '',
		},
		{
			displayName: 'Authentication Database',
			name: 'authSource',
			type: 'string',
			displayOptions: { show: { configurationType: ['values'] } },
			default: 'admin',
			required: true,
		},
		{
			displayName: 'Use TLS',
			name: 'tls',
			type: 'boolean',
			displayOptions: { show: { configurationType: ['values'] } },
			default: true,
		},
		{
			displayName: 'Default Database',
			name: 'database',
			type: 'string',
			default: '',
			placeholder: 'myDatabase',
			description: 'Database used by operations other than List Databases',
		},
	];
}