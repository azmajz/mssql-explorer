const vscode = require('vscode');
const { EXTENSION_CONFIG } = require('../constants');
const { ConnectionCommands } = require('./connectionCommands');
const { DatabaseCommands } = require('./databaseCommands');
const { FilterCommands } = require('./filterCommands');
const { ObjectCommands } = require('./objectCommands');

/**
 * Register all extension commands
 * @param {vscode.ExtensionContext} context 
 * @param {Object} dependencies - Dependencies needed by commands
 */
function registerCommands(context, dependencies) {
    const { connectionManager, treeProvider, gridViewerPanel, connectionsPanel } = dependencies;

    // Connection management commands
    const connectionCommands = new ConnectionCommands(connectionManager, treeProvider);
    context.subscriptions.push(
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.ADD_CONNECTION, 
            () => connectionCommands.addConnection()),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.EDIT_CONNECTION, 
            (item) => connectionCommands.editConnection(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.DELETE_CONNECTION, 
            (item) => connectionCommands.deleteConnection(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.CONNECT, 
            (item) => connectionCommands.connect(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.DISCONNECT, 
            () => connectionCommands.disconnect()),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.OPEN_CONNECTIONS_PANEL, 
            () => connectionsPanel.createOrShow(context, connectionManager))
    );

    // Database and object commands
    const databaseCommands = new DatabaseCommands(connectionManager, treeProvider);
    const objectCommands = new ObjectCommands(connectionManager, gridViewerPanel);
    context.subscriptions.push(
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.PREVIEW_DATA, 
            (item) => objectCommands.previewData(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.COPY_TABLE_NAME, 
            (item) => objectCommands.copyTableName(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.OPEN_OBJECT, 
            (args) => objectCommands.openObject(args))
    );

    // Filter commands
    const filterCommands = new FilterCommands(treeProvider);
    context.subscriptions.push(
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.FILTER_GROUP, 
            (item) => filterCommands.filterGroup(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.CLEAR_GROUP_FILTER, 
            (item) => filterCommands.clearGroupFilter(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.FILTER_DATABASE, 
            (item) => filterCommands.filterDatabase(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.CLEAR_DATABASE_FILTER, 
            (item) => filterCommands.clearDatabaseFilter(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.OPEN_FILTER_RESULTS, 
            (item) => filterCommands.openFilterResults(item))
    );

    // Utility commands
    context.subscriptions.push(
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.REFRESH, 
            () => treeProvider.refresh())
    );
}

module.exports = { registerCommands };
