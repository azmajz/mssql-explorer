const vscode = require('vscode');

class DatabaseCommands {
    constructor(connectionManager, treeProvider) {
        this.connectionManager = connectionManager;
        this.treeProvider = treeProvider;
    }

    // Database-specific commands can be added here in the future
    // For now, this is a placeholder for database-related functionality
}

module.exports = { DatabaseCommands };
