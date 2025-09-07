const vscode = require('vscode');

class MssqlTreeProvider {
    constructor(connectionManager) {
        this.connectionManager = connectionManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() { this._onDidChangeTreeData.fire(); }

    getTreeItem(element) { return element; }

    async getChildren(element) {
        const cm = this.connectionManager;
        if (!element) {
            // Root: list connections directly
            const connections = cm.listConnections();
            if (!connections || connections.length === 0) {
                const tip = new vscode.TreeItem('Add a connection to get started', vscode.TreeItemCollapsibleState.None);
                tip.iconPath = new vscode.ThemeIcon('plug');
                tip.command = { command: 'mssql-explorer.addConnection', title: 'Add Connection' };
                return [tip];
            }
            return connections.map(c => this._asConnectionItem(c));
        }

        if (element.contextValue === 'connection') {
            // Show folders: Databases
            const databases = new vscode.TreeItem('Databases', vscode.TreeItemCollapsibleState.Collapsed);
            databases.iconPath = new vscode.ThemeIcon('database');
            databases.contextValue = 'databases';
            databases.id = 'databases';
            return [databases];
        }

        if (element.contextValue === 'databases') {
            const active = this.connectionManager.active;
            if (!active) { return []; }
            const request = active.pool.request();
            const result = await request.query('SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name');
            return result.recordset.map(row => {
                const item = new vscode.TreeItem(row.name, vscode.TreeItemCollapsibleState.Collapsed);
                item.iconPath = new vscode.ThemeIcon('database');
                item.contextValue = 'database';
                item.id = `db|${row.name}`;
                return item;
            });
        }

        if (element.contextValue === 'database') {
            const dbName = String(element.id).split('|')[1];
            const tables = new vscode.TreeItem('Tables', vscode.TreeItemCollapsibleState.Collapsed);
            tables.iconPath = new vscode.ThemeIcon('table');
            tables.contextValue = 'tables';
            tables.id = `tables|${dbName}`;

            const views = new vscode.TreeItem('Views', vscode.TreeItemCollapsibleState.Collapsed);
            views.iconPath = new vscode.ThemeIcon('eye');
            views.contextValue = 'views';
            views.id = `views|${dbName}`;

            const procs = new vscode.TreeItem('Stored Procedures', vscode.TreeItemCollapsibleState.Collapsed);
            procs.iconPath = new vscode.ThemeIcon('gear');
            procs.contextValue = 'procedures';
            procs.id = `procedures|${dbName}`;

            const funcs = new vscode.TreeItem('Functions', vscode.TreeItemCollapsibleState.Collapsed);
            funcs.iconPath = new vscode.ThemeIcon('symbol-function');
            funcs.contextValue = 'functions';
            funcs.id = `functions|${dbName}`;

            return [tables, views, procs, funcs];
        }

        const active = this.connectionManager.active;
        if (!active) { return []; }

        if (element.contextValue === 'tables') {
            const request = active.pool.request();
            const dbName = String(element.id).split('|')[1];
            const result = await request.query(`USE [${dbName}]; SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME`);
            return result.recordset.map(row => this._asLeaf(`${row.TABLE_SCHEMA}.${row.TABLE_NAME}`, 'table', 'table', dbName, row.TABLE_SCHEMA, row.TABLE_NAME));
        }

        if (element.contextValue === 'views') {
            const request = active.pool.request();
            const dbName = String(element.id).split('|')[1];
            const result = await request.query(`USE [${dbName}]; SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS ORDER BY TABLE_SCHEMA, TABLE_NAME`);
            return result.recordset.map(row => this._asLeaf(`${row.TABLE_SCHEMA}.${row.TABLE_NAME}`, 'view', 'eye', dbName, row.TABLE_SCHEMA, row.TABLE_NAME));
        }

        if (element.contextValue === 'procedures') {
            const request = active.pool.request();
            const dbName = String(element.id).split('|')[1];
            const result = await request.query(`USE [${dbName}]; SELECT SPECIFIC_SCHEMA AS [schema], SPECIFIC_NAME AS [name] FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE='PROCEDURE' ORDER BY SPECIFIC_SCHEMA, SPECIFIC_NAME`);
            return result.recordset.map(row => this._asLeaf(`${row.schema}.${row.name}`, 'storedProcedure', 'gear', dbName, row.schema, row.name));
        }

        if (element.contextValue === 'functions') {
            const request = active.pool.request();
            const dbName = String(element.id).split('|')[1];
            const result = await request.query(`USE [${dbName}]; SELECT SPECIFIC_SCHEMA AS [schema], SPECIFIC_NAME AS [name] FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE='FUNCTION' ORDER BY SPECIFIC_SCHEMA, SPECIFIC_NAME`);
            return result.recordset.map(row => this._asLeaf(`${row.schema}.${row.name}`, 'function', 'symbol-function', dbName, row.schema, row.name));
        }

        return [];
    }

    _asConnectionItem(connection) {
        const item = new vscode.TreeItem(connection.name || connection.config.server, vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = new vscode.ThemeIcon('server');
        item.contextValue = 'connection';
        item.id = `conn|${connection.id}`;
        item.description = this.connectionManager.active && this.connectionManager.active.id === connection.id ? 'connected' : '';
        return item;
    }

    _asLeaf(label, kind, icon, databaseName, schema, name) {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.contextValue = kind;
        item.command = {
            command: 'mssql-explorer.openObject',
            title: 'Open',
            arguments: [{ databaseName, schema, name, kind }]
        };
        try {
            item.resourceUri = vscode.Uri.parse(`mssql://${encodeURIComponent(databaseName)}/${encodeURIComponent(schema)}/${encodeURIComponent(name)}`);
        } catch {}
        return item;
    }
}

module.exports = { MssqlTreeProvider };


