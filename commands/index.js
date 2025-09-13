const vscode = require('vscode');
const { EXTENSION_CONFIG } = require('../constants');
const { ConnectionCommands } = require('./connectionCommands');
// const { DatabaseCommands } = require('./databaseCommands');
const { FilterCommands } = require('./filterCommands');
const { ObjectCommands } = require('./objectCommands');
const { QueryCommands } = require('./queryCommands');

/**
 * Register all extension commands
 * @param {vscode.ExtensionContext} context 
 * @param {Object} dependencies - Dependencies needed by commands
 */
function registerCommands(context, dependencies) {
    const { connectionManager, connectionsTreeProvider, bookmarkedTreeProvider, gridViewerPanel, queryManager } = dependencies;

    // Connection management commands
    const connectionCommands = new ConnectionCommands(connectionManager, connectionsTreeProvider, context);
    context.subscriptions.push(
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.ADD_CONNECTION, 
            () => connectionCommands.addConnection()),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.OPEN_CONNECTION_VIEW, 
            () => connectionCommands.addConnection()),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.EDIT_CONNECTION, 
            (item) => connectionCommands.editConnection(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.DELETE_CONNECTION, 
            (item) => connectionCommands.deleteConnection(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.CONNECT, 
            (item) => connectionCommands.connect(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.DISCONNECT, 
            () => connectionCommands.disconnect()),
    );

    // Database and object commands
    // const databaseCommands = new DatabaseCommands(connectionManager, connectionsTreeProvider);
    const objectCommands = new ObjectCommands(connectionManager, gridViewerPanel);
    context.subscriptions.push(
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.PREVIEW_DATA, 
            (item) => objectCommands.previewData(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.COPY_TABLE_NAME, 
            (item) => objectCommands.copyTableName(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.OPEN_OBJECT, 
            (args) => objectCommands.openObject(args)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.SELECT_DATA_WITH_OPTIONS, 
            (item) => objectCommands.selectDataWithOptions(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.OPEN_TEST_VIEW, 
            (item) => objectCommands.openTestView(item))
    );

    // Filter commands
    const filterCommands = new FilterCommands(connectionsTreeProvider);
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

    // Query management commands
    const queryCommands = new QueryCommands(queryManager, bookmarkedTreeProvider, connectionManager);
    context.subscriptions.push(
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.ADD_QUERY, 
            () => queryCommands.addQuery()),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.EDIT_QUERY, 
            (item) => queryCommands.editQuery(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.DELETE_QUERY, 
            (item) => queryCommands.deleteQuery(item)),
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.EXECUTE_QUERY, 
            (item) => queryCommands.executeQuery(item))
    );

    // Utility commands
    context.subscriptions.push(
        vscode.commands.registerCommand(EXTENSION_CONFIG.COMMANDS.REFRESH, 
            () => {
                connectionsTreeProvider.refresh();
                bookmarkedTreeProvider.refresh();
            })
    );
}

module.exports = { registerCommands };
