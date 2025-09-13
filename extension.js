const vscode = require('vscode');
const { ConnectionManager } = require('./connectionManager');
const { ConnectionsTreeProvider } = require('./connectionsTreeProvider');
const { BookmarkedTreeProvider } = require('./bookmarkedTreeProvider');
const { GridViewerPanel } = require('./gridViewer');
const { AdvancedGridViewerPanel } = require('./advancedGridViewer');
const { TestViewerPanel } = require('./testViewer');
const { QueryManager } = require('./queryManager');
const { registerCommands } = require('./commands');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // Initialize core components
    const connectionManager = new ConnectionManager(context);
    const queryManager = new QueryManager(context);
    const connectionsTreeProvider = new ConnectionsTreeProvider(connectionManager);
    const bookmarkedTreeProvider = new BookmarkedTreeProvider(queryManager);
    const gridViewerPanel = GridViewerPanel;

    // Create tree views
    const connectionsView = vscode.window.createTreeView('mssqlConnections', { 
        treeDataProvider: connectionsTreeProvider, 
        showCollapseAll: true 
    });
    context.subscriptions.push(connectionsView);

    const bookmarkedView = vscode.window.createTreeView('mssqlBookmarked', { 
        treeDataProvider: bookmarkedTreeProvider, 
        showCollapseAll: true 
    });
    context.subscriptions.push(bookmarkedView);

    // Register all commands
    registerCommands(context, {
        connectionManager,
        connectionsTreeProvider,
        bookmarkedTreeProvider,
        gridViewerPanel,
        queryManager
    });
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
