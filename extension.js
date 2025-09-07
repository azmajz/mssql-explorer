// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const { ConnectionDialogPanel, setGlobalReferences } = require('./connectionDialog');
const { SimpleTreeDataProvider } = require('./simpleTreeProvider');
const { MainContentPanel } = require('./mainContentPanel');
const { QueryExecutor } = require('./queryExecutor');

// Database connection configuration
let connectionConfig = null;
let connectionPool = null;
let treeDataProvider = null;
let extensionContext;

function activate(context) {
    extensionContext = context;
    console.log('MSSQL Explorer extension is now active!');

    // Create simple tree data provider
    treeDataProvider = new SimpleTreeDataProvider();

    // Register tree data provider
    vscode.window.createTreeView('mssqlExplorer', {
        treeDataProvider: treeDataProvider
    });

    // Set global references for connection dialog
    setGlobalReferences(treeDataProvider, connectionConfig, connectionPool);

    // Register commands
    const connectCommand = vscode.commands.registerCommand('mssql-explorer.connect', async () => {
        await connectToDatabase();
    });

    const disconnectCommand = vscode.commands.registerCommand('mssql-explorer.disconnect', async () => {
        await disconnectFromDatabase();
    });

    const executeQueryCommand = vscode.commands.registerCommand('mssql-explorer.executeQuery', async () => {
        await QueryExecutor.executeCustomQuery(connectionPool);
    });

    const openExplorerCommand = vscode.commands.registerCommand('mssql-explorer.openExplorer', () => {
        MainContentPanel.createOrShow(context, connectionConfig, connectionPool);
    });

    // Add all commands to subscriptions
    context.subscriptions.push(
        connectCommand,
        disconnectCommand,
        executeQueryCommand,
        openExplorerCommand
    );
}

async function connectToDatabase() {
    ConnectionDialogPanel.createOrShow(extensionContext);
}

async function disconnectFromDatabase() {
    try {
        if (connectionPool) {
            await connectionPool.close();
            connectionPool = null;
            connectionConfig = null;
            vscode.window.showInformationMessage('Disconnected from database');
            treeDataProvider.refresh();
        } else {
            vscode.window.showInformationMessage('Not connected to any database');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Disconnect failed: ${error.message}`);
    }
}

function deactivate() {
    if (connectionPool) {
        connectionPool.close();
    }
}

// Function to update connection state from connection dialog
function updateConnectionState(config, pool) {
    connectionConfig = config;
    connectionPool = pool;
}

module.exports = {
	activate,
	deactivate,
	updateConnectionState
};