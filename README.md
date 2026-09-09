# n8n-nodes-documentdb

This is an n8n community node for reading and writing data in [Azure DocumentDB](https://learn.microsoft.com/en-us/azure/documentdb/) and MongoDB-compatible [open-source DocumentDB](https://documentdb.io/) deployments.

[n8n](https://n8n.io/) is a workflow automation platform. DocumentDB is a document database with MongoDB-compatible connectivity.

## Prerequisites

- Node.js 22 or later for local package development
- An Azure DocumentDB cluster or a reachable DocumentDB-compatible deployment
- A database user with only the permissions required by your workflows
- Network access from the n8n host to the database endpoint

## Installation

Install this package from **Settings > Community Nodes** in a self-hosted n8n instance using:

```text
n8n-nodes-documentdb
```

Alternatively, install it in the n8n community nodes directory:

```bash
npm install n8n-nodes-documentdb
```

Restart n8n after manual installation. Verified packages can also be installed through n8n's node panel when approved in the Creator Portal.

## Credentials

Create a **DocumentDB** credential in n8n. Choose one of these configuration types:

- **Connection String**: Paste the MongoDB-compatible connection string supplied by your deployment. The value must begin with `mongodb://` or `mongodb+srv://`.
- **Connection Values**: Enter host, port, user, password, authentication database, and TLS preference separately.

Set **Default Database** for every operation except **List Databases**. Azure DocumentDB commonly requires TLS. Store credentials only in n8n's credential store; do not place secrets in workflow fields.

Use **Test credential** to connect and run a database `ping` command.

## Supported Operations

- **List Databases**: List databases visible to the credential.
- **List Collections**: List collections in the default database.
- **Find**: Find documents with optional projection, sorting, skip, and limit.
- **Insert**: Insert one JSON document for each input item.
- **Update**: Update the first or all matching documents with operators such as `$set`.
- **Delete**: Delete the first or all matching documents.
- **Aggregate**: Execute a MongoDB-compatible aggregation pipeline.

## Example Workflows

### Insert incoming data

1. Add a trigger that emits JSON.
2. Add **DocumentDB** and select **Insert**.
3. Set the collection name.
4. Leave **Document** as `={{$json}}`, or map a smaller JSON object.

### Find recent orders

1. Select **Find** and set the collection to `orders`.
2. Use `{"status":"open"}` as the filter.
3. Add **Sort** with `{"createdAt":-1}` and set **Limit** to `25`.

### Update a document

1. Select **Update** and use `{"externalId":"={{$json.id}}"}` as the filter.
2. Use `{"$set":{"status":"processed"}}` as the update.
3. Enable **Update All Matches** only when every matching document should change.

## Limitations

- Supported commands depend on the MongoDB compatibility level of the target DocumentDB deployment.
- Extended JSON strings are not converted automatically to BSON types. Values are sent as standard JSON values.
- Operations run once per incoming item, except database and collection listing.
- The node does not read environment variables, certificates from disk, or other filesystem content at runtime.
- DocumentDB uses the MongoDB wire protocol. The MongoDB Node.js driver is bundled into the compiled node during the build, so the published package has no external runtime dependencies.

## Development

```bash
npm install
npm run lint
npm run build
npm run dev
```

`npm run dev` starts an n8n development instance with the node loaded. `npm run release` performs the official `@n8n/node-cli` release workflow.

## Resources

- [Azure DocumentDB documentation](https://learn.microsoft.com/en-us/azure/documentdb/)
- [DocumentDB documentation](https://documentdb.io/docs/)
- [n8n community node documentation](https://docs.n8n.io/integrations/community-nodes/)
- [n8n Creator Portal](https://creators.n8n.io/nodes)

## License

[MIT](LICENSE)
