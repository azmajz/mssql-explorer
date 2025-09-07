// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
// const path = require('path');

const { ConnectionsTreeProvider } = require('./src/tree/ConnectionsTreeProvider');
const { WebviewController } = require('./src/webview/WebviewController');
const { GlobalState } = require('./src/state/GlobalState');
const { ConnectionManager } = require('./src/connection/ConnectionManager');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	console.log('mssql-explorer activated');

	const globalState = new GlobalState(context);
	const connectionManager = new ConnectionManager(context, globalState);
	const connectionsTree = new ConnectionsTreeProvider(globalState, connectionManager);
	const treeView = vscode.window.createTreeView('mssqlConnections', { treeDataProvider: connectionsTree });
	context.subscriptions.push(treeView);

	const webviews = new WebviewController(context, globalState, connectionManager);

	context.subscriptions.push(
		vscode.commands.registerCommand('mssqlExplorer.newConnection', async () => {
			webviews.openNewConnectionForm();
		}),
		vscode.commands.registerCommand('mssqlExplorer.refreshConnections', () => connectionsTree.refresh()),
		vscode.commands.registerCommand('mssqlExplorer.openInTab', (item) => webviews.openConnection(item?.connectionId)),
		vscode.commands.registerCommand('mssqlExplorer.connect', (item) => webviews.openConnection(item?.connectionId)),
		vscode.commands.registerCommand('mssqlExplorer.disconnect', (item) => connectionsTree.disconnect(item)),
		vscode.commands.registerCommand('mssqlExplorer.editConnection', (item) => connectionsTree.editConnection(item)),
		vscode.commands.registerCommand('mssqlExplorer.deleteConnection', (item) => connectionsTree.deleteConnection(item))
	);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
