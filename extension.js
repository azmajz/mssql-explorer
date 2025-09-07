// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const { ConnectionManager } = require('./connectionManager');
const { MssqlTreeProvider } = require('./mssqlTreeProvider');
const { GridViewerPanel } = require('./gridViewer');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('mssql-explorer active');

	const connectionManager = new ConnectionManager(context);
	const tree = new MssqlTreeProvider(connectionManager);
	const treeView = vscode.window.createTreeView('mssqlExplorer', { treeDataProvider: tree, showCollapseAll: true });
	context.subscriptions.push(treeView);

	async function pickConnection(cm) {
		const list = cm.listConnections();
		if (!list.length) { vscode.window.showInformationMessage('No connections'); return undefined; }
		const labelToId = new Map();
		const options = list.map(c => {
			const label = `${c.name} (${c.config.server})`;
			labelToId.set(label, c.id);
			return label;
		});
		const picked = await vscode.window.showQuickPick(options);
		return picked ? labelToId.get(picked) : undefined;
	}

	context.subscriptions.push(
		vscode.commands.registerCommand('mssql-explorer.filterGroup', async (item) => {
			if (!item || !item.id) { return; }
			const [group, dbName] = String(item.id).split('|');
			const value = await vscode.window.showInputBox({ prompt: `Filter ${group} in ${dbName}`, placeHolder: 'Enter search text' });
			tree.setGroupFilter(group, dbName, value || '');
		}),
		vscode.commands.registerCommand('mssql-explorer.clearGroupFilter', async (item) => {
			if (!item || !item.id) { return; }
			const [group, dbName] = String(item.id).split('|');
			tree.setGroupFilter(group, dbName, '');
		}),
		vscode.commands.registerCommand('mssql-explorer.filterDatabase', async (item) => {
			if (!item || !item.id || !String(item.id).startsWith('db|')) { return; }
			const dbName = String(item.id).split('|')[1];
			const value = await vscode.window.showInputBox({ prompt: `Filter all objects in ${dbName}`, placeHolder: 'Enter search text' });
			tree.setDatabaseFilter(dbName, value || '');
		}),
		vscode.commands.registerCommand('mssql-explorer.clearDatabaseFilter', async (item) => {
			if (!item || !item.id || !String(item.id).startsWith('db|')) { return; }
			const dbName = String(item.id).split('|')[1];
			tree.setDatabaseFilter(dbName, '');
		}),
		vscode.commands.registerCommand('mssql-explorer.previewData', async (item) => {
			if (!connectionManager.active) { return vscode.window.showErrorMessage('Not connected'); }
			if (!item || !item.databaseName || !item.label) { return; }
			const [schema, name] = String(item.label).split('.');
			GridViewerPanel.createOrShow(context, connectionManager.active.pool, item.databaseName, schema, name, 'table');
		}),
		vscode.commands.registerCommand('mssql-explorer.copyTableName', async (item) => {
			if (!item || !item.label) { return; }
			await vscode.env.clipboard.writeText(String(item.label));
			vscode.window.showInformationMessage('Table name copied');
		}),
		vscode.commands.registerCommand('mssql-explorer.addConnection', async () => {
			const id = Date.now().toString();
			const name = await vscode.window.showInputBox({ prompt: 'Connection name', value: 'MSSQL' });
			if (!name) { return; }
			// Reuse existing connect dialog code path via command mssql-explorer.connect if needed later
			const server = await vscode.window.showInputBox({ prompt: 'Server', placeHolder: 'localhost\\SQLEXPRESS' });
			if (!server) { return; }
			const database = await vscode.window.showInputBox({ prompt: 'Database (optional)' });
			const user = await vscode.window.showInputBox({ prompt: 'User', value: 'sa' });
			const password = await vscode.window.showInputBox({ prompt: 'Password', password: true });
			const config = {
				server,
				database,
				driver: 'msnodesqlv8',
				options: { trustedConnection: false, trustServerCertificate: true },
				user,
				password
			};
			try {
				await connectionManager.test(config);
				await connectionManager.addConnection({ id, name, config });
				tree.refresh();
			} catch (e) {
				vscode.window.showErrorMessage(`Connection failed: ${e.message}`);
			}
		}),
		vscode.commands.registerCommand('mssql-explorer.editConnection', async (item) => {
			const id = item?.connectionId || (await pickConnection(connectionManager));
			if (!id) { return; }
			const conn = connectionManager.listConnections().find(c => c.id === id);
			const name = await vscode.window.showInputBox({ prompt: 'Connection name', value: conn.name });
			if (!name) { return; }
			await connectionManager.updateConnection(id, { name });
			tree.refresh();
		}),
		vscode.commands.registerCommand('mssql-explorer.deleteConnection', async (item) => {
			const id = item?.connectionId || (await pickConnection(connectionManager));
			if (!id) { return; }
			const confirm = await vscode.window.showWarningMessage('Delete connection?', { modal: true }, 'Delete');
			if (confirm === 'Delete') {
				await connectionManager.deleteConnection(id);
				tree.refresh();
			}
		}),
		vscode.commands.registerCommand('mssql-explorer.connect', async (item) => {
			const id = item?.connectionId || (await pickConnection(connectionManager));
			if (!id) { return; }
			const conn = connectionManager.listConnections().find(c => c.id === id);
			if (!conn) { return vscode.window.showErrorMessage('Connection not found'); }
			try {
				await connectionManager.connect(conn);
				vscode.window.showInformationMessage(`Connected: ${conn.name}`);
			} catch (e) {
				return vscode.window.showErrorMessage(`Connect failed: ${e.message}`);
			}
			tree.refresh();
		}),
		vscode.commands.registerCommand('mssql-explorer.disconnect', async () => {
			await connectionManager.disconnect();
			tree.refresh();
		}),
		vscode.commands.registerCommand('mssql-explorer.refresh', () => tree.refresh()),
		vscode.commands.registerCommand('mssql-explorer.openObject', async (args) => {
			const { databaseName, schema, name, kind } = args;
			if (!connectionManager.active) {
				return vscode.window.showErrorMessage('Not connected');
			}
			if (kind === 'table' || kind === 'view') {
				GridViewerPanel.createOrShow(context, connectionManager.active.pool, databaseName, schema, name, kind);
				return;
			}
			// show definition for routines/functions
			const req = connectionManager.active.pool.request();
			const query = `USE [${databaseName}]; SELECT OBJECT_DEFINITION(OBJECT_ID('[${schema}].[${name}]')) AS Definition`;
			try {
				const res = await req.query(query);
				const doc = await vscode.workspace.openTextDocument({ language: 'sql', content: res.recordset?.[0]?.Definition || '-- No definition' });
				await vscode.window.showTextDocument(doc, { preview: true });
			} catch (e) {
				vscode.window.showErrorMessage(e.message);
			}
		})
	);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
