const vscode = require('vscode');

class BookmarkedTreeProvider {
    constructor(queryManager) {
        this.queryManager = queryManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() { this._onDidChangeTreeData.fire(); }

    getTreeItem(element) { return element; }

    async getChildren(element) {
        if (!element) {
            const queries = this.queryManager.getAllQueries();
            if (!queries || queries.length === 0) {
                const tip = new vscode.TreeItem('No saved queries', vscode.TreeItemCollapsibleState.None);
                tip.iconPath = new vscode.ThemeIcon('bookmark');
                tip.command = { command: 'mssql-explorer.addQuery', title: 'Add Query' };
                return [tip];
            }
            return queries.map(q => this._asQueryItem(q));
        }

        return [];
    }

    _asQueryItem(query) {
        const item = new vscode.TreeItem(query.name, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('bookmark');
        item.contextValue = 'savedQuery';
        item.id = `query|${query.id}`;
        item.description = query.description || '';
        item.tooltip = `Query: ${query.name}\n${query.description || 'No description'}\nCreated: ${new Date(query.createdAt).toLocaleDateString()}`;
        item.command = {
            command: 'mssql-explorer.executeQuery',
            title: 'Execute Query',
            arguments: [{ queryId: query.id }]
        };
        return item;
    }
}

module.exports = { BookmarkedTreeProvider };
