const vscode = require('vscode');

class ConnectionItem extends vscode.TreeItem {
	constructor(connection, isConnected) {
		super(connection.name, vscode.TreeItemCollapsibleState.None);
		this.contextValue = isConnected ? 'connection:connected' : 'connection:disconnected';
		this.description = connection.server;
		this.iconPath = new vscode.ThemeIcon('database');
		this.command = {
			command: 'mssqlExplorer.openInTab',
			title: 'Open in Tab',
			arguments: [this]
		};
		this.connectionId = connection.id;
	}
}

class ConnectionsTreeProvider {
	constructor(globalState, connectionManager) {
		this.globalState = globalState;
		this.connectionManager = connectionManager;
		this._onDidChangeTreeData = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
	}

	refresh() {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element) { return element; }

	async getChildren() {
		const saved = await this.globalState.getConnections();
		return saved.map(c => new ConnectionItem(c, this.connectionManager.isConnected(c.id)));
	}

	// Creation handled by webview controller's new connection form

	async connect(item) {
		await this.connectionManager.ensureConnected(item.connectionId);
		this.refresh();
	}

	disconnect(item) {
		this.connectionManager.disconnect(item.connectionId);
		this.refresh();
	}

	async editConnection(item) {
		const conn = await this.globalState.getConnectionById(item.connectionId);
		if (!conn) { return; }
		const name = await vscode.window.showInputBox({ prompt: 'Friendly name', value: conn.name });
		if (!name) { return; }
		const server = await vscode.window.showInputBox({ prompt: 'Server', value: conn.server });
		if (!server) { return; }
		const user = await vscode.window.showInputBox({ prompt: 'User', value: conn.user });
		await this.globalState.updateConnection({ ...conn, name, server, user });
		this.refresh();
	}

	async deleteConnection(item) {
		await this.globalState.deleteConnection(item.connectionId);
		this.connectionManager.disconnect(item.connectionId);
		this.refresh();
	}
}

module.exports = { ConnectionsTreeProvider };


