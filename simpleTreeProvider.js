const vscode = require('vscode');

class SimpleTreeDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.connectionConfig = null;
        this.connectionPool = null;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren() {
        if (!this.connectionPool) {
            // Show connect button when not connected
            const connectItem = new vscode.TreeItem('Click to Connect', vscode.TreeItemCollapsibleState.None);
            connectItem.command = {
                command: 'mssql-explorer.connect',
                title: 'Connect to Database'
            };
            connectItem.iconPath = new vscode.ThemeIcon('link');
            return [connectItem];
        } else {
            // Show connection status when connected
            const statusItem = new vscode.TreeItem(`Connected to: ${this.connectionConfig.server}`, vscode.TreeItemCollapsibleState.None);
            statusItem.iconPath = new vscode.ThemeIcon('check');
            
            const openExplorerItem = new vscode.TreeItem('Open MSSQL Explorer', vscode.TreeItemCollapsibleState.None);
            openExplorerItem.command = {
                command: 'mssql-explorer.openExplorer',
                title: 'Open MSSQL Explorer'
            };
            openExplorerItem.iconPath = new vscode.ThemeIcon('database');
            
            return [statusItem, openExplorerItem];
        }
    }

    updateConnectionState(config, pool) {
        this.connectionConfig = config;
        this.connectionPool = pool;
        this.refresh();
    }
}

module.exports = { SimpleTreeDataProvider };
