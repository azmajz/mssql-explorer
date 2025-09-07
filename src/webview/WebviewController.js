const vscode = require('vscode');
const path = require('path');
const { MssqlRepository } = require('../data/MssqlRepository');

class WebviewController {
	constructor(context, globalState, connectionManager) {
		this.context = context;
		this.globalState = globalState;
		this.connectionManager = connectionManager;
		this.panels = new Map(); // id -> panel
		this.repo = new MssqlRepository(connectionManager);
	}

	openNewConnectionForm() {
		const panel = vscode.window.createWebviewPanel(
			'mssqlExplorer.newConnection',
			'New MSSQL Connection',
			vscode.ViewColumn.Active,
			{ enableScripts: true, retainContextWhenHidden: true }
		);
		panel.webview.html = this._getNewConnectionHtml(panel.webview);
		panel.webview.onDidReceiveMessage(async (msg) => {
			try {
				if (msg.command === 'connect') {
					const id = await this.globalState.addConnection({
						name: msg.connectionData.name || 'Connection',
						server: msg.connectionData.server,
						database: msg.connectionData.database,
						user: msg.connectionData.user,
						password: msg.connectionData.password,
						options: msg.connectionData.options
					});
					vscode.commands.executeCommand('mssqlExplorer.refreshConnections');
					panel.webview.postMessage({ command: 'connectResult', success: true });
					setTimeout(() => panel.dispose(), 500);
				} else if (msg.command === 'test') {
					await this.connectionManager.testConnectionData(msg.connectionData);
					panel.webview.postMessage({ command: 'testResult', success: true });
				} else if (msg.command === 'cancel') {
					panel.dispose();
				}
			} catch (err) {
				const message = (err && err.message) ? err.message : (typeof err === 'string' ? err : JSON.stringify(err));
				if (msg.command === 'test') {
					panel.webview.postMessage({ command: 'testResult', success: false, error: message });
				} else if (msg.command === 'connect') {
					panel.webview.postMessage({ command: 'connectResult', success: false, error: message });
				}
			}
		});
		return panel;
	}

	async openConnection(connectionId) {
		if (!connectionId) return;
		let panel = this.panels.get(connectionId);
		if (panel) {
			panel.reveal();
			return;
		}
		let initialConnected = false;
		try {
			initialConnected = await this.connectionManager.ensureConnected(connectionId);
		} catch (_) { /* ignore, will show login */ }
		panel = vscode.window.createWebviewPanel(
			'mssqlExplorer',
			'MSSQL Console',
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);
		panel.webview.html = await this._getHtml(panel.webview, connectionId, initialConnected);
		panel.onDidDispose(() => this.panels.delete(connectionId));
		panel.webview.onDidReceiveMessage(async (msg) => {
			try {
				if (msg.type === 'connect') {
					const ok = await this.connectionManager.ensureConnected(connectionId, msg.password);
					panel.webview.postMessage({ type: 'connectionStatus', connected: ok });
				} else if (msg.type === 'listDatabases') {
					const dbs = await this.repo.listDatabases(connectionId);
					panel.webview.postMessage({ type: 'databases', items: dbs });
				} else if (msg.type === 'listSchemas') {
					const schemas = await this.repo.listSchemas(connectionId, msg.database);
					panel.webview.postMessage({ type: 'schemas', database: msg.database, items: schemas });
				} else if (msg.type === 'listObjects') {
					const objs = await this.repo.listObjects(connectionId, msg.database, msg.schema);
					panel.webview.postMessage({ type: 'objects', database: msg.database, schema: msg.schema, items: objs });
				} else if (msg.type === 'runQuery') {
					const res = await this.repo.runQuery(connectionId, msg.database, msg.sql, msg.offset || 0, msg.limit || 100);
					panel.webview.postMessage({ type: 'queryResult', result: { ...res, page: (msg.offset||0)/(msg.limit||100), limit: msg.limit||100 } });
				} else if (msg.type === 'getTableDDL') {
					const ddl = await this.repo.getTableDDL(connectionId, msg.database, msg.schema, msg.table);
					panel.webview.postMessage({ type: 'ddl', schema: msg.schema, name: msg.table, ddl });
				} else if (msg.type === 'getRoutineDef') {
					const def = await this.repo.getRoutineDefinition(connectionId, msg.database, msg.schema, msg.name);
					panel.webview.postMessage({ type: 'routine', schema: msg.schema, name: msg.name, definition: def });
				}
			} catch (err) {
				panel.webview.postMessage({ type: 'error', message: String(err && err.message || err) });
			}
		});
		this.panels.set(connectionId, panel);
	}

	_getNewConnectionHtml(webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'webview', 'new-connection.js')));
		const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'webview', 'styles', 'base.css')));
		return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet" />
  <title>New Connection</title>
</head>
<body>
  <div id="app"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
	}

	async _getHtml(webview, connectionId, connected) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'webview', 'main.js')));
		const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'webview', 'styles', 'base.css')));
		const conn = await this.globalState.getConnectionById(connectionId);
		return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet" />
  <title>MSSQL Console</title>
</head>
<body>
  <div id="app" data-conn='${JSON.stringify({ name: conn?.name, server: conn?.server, database: conn?.database, user: conn?.user, connected: !!connected })}'></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
	}
}

module.exports = { WebviewController };


