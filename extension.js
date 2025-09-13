const vscode = require('vscode');
const { ConnectionManager } = require('./connectionManager');
const { MssqlTreeProvider } = require('./mssqlTreeProvider');
const { GridViewerPanel } = require('./gridViewer');
const { ConnectionsPanel } = require('./connectionsPanel');
const { registerCommands } = require('./commands');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // Initialize core components
    const connectionManager = new ConnectionManager(context);
    const treeProvider = new MssqlTreeProvider(connectionManager);
    const gridViewerPanel = GridViewerPanel;
    const connectionsPanel = ConnectionsPanel;

    // Create tree view
    const treeView = vscode.window.createTreeView('mssqlExplorer', { 
        treeDataProvider: treeProvider, 
        showCollapseAll: true 
    });
    context.subscriptions.push(treeView);

    // Register all commands
    registerCommands(context, {
        connectionManager,
        treeProvider,
        gridViewerPanel,
        connectionsPanel
    });
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
