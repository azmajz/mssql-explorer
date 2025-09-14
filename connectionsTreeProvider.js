const vscode = require('vscode');
const { EXTENSION_CONFIG } = require('./constants');

class ConnectionsTreeProvider {
    constructor(connectionManager) {
        this.connectionManager = connectionManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._filters = {
            database: new Map(),
            tables: new Map(),
            views: new Map(),
            procedures: new Map(),
            functions: new Map()
        };
    }

    refresh() { this._onDidChangeTreeData.fire(); }

    setGroupFilter(group, dbName, filter) {
        const map = this._filters[group];
        if (!map) { return; }
        if (filter) { map.set(dbName, filter.toLowerCase()); }
        else { map.delete(dbName); }
        this.refresh();
    }

    setDatabaseFilter(dbName, filter) {
        if (filter) { this._filters.database.set(dbName, filter.toLowerCase()); }
        else { this._filters.database.delete(dbName); }
        this.refresh();
    }

    getTreeItem(element) { return element; }

    async buildFilterResults(kind, dbName) {
        if (!this.connectionManager.active) { return '# Not connected'; }
        const pool = this.connectionManager.active.pool;
        const dbFilter = this._filters.database.get(dbName) || '';
        const sqlFor = {
            tables: `USE [${dbName}]; SELECT TABLE_SCHEMA AS [schema], TABLE_NAME AS [name] FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
            views: `USE [${dbName}]; SELECT TABLE_SCHEMA AS [schema], TABLE_NAME AS [name] FROM INFORMATION_SCHEMA.VIEWS ORDER BY TABLE_SCHEMA, TABLE_NAME`,
            procedures: `USE [${dbName}]; SELECT SPECIFIC_SCHEMA AS [schema], SPECIFIC_NAME AS [name] FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE='PROCEDURE' ORDER BY SPECIFIC_SCHEMA, SPECIFIC_NAME`,
            functions: `USE [${dbName}]; SELECT SPECIFIC_SCHEMA AS [schema], SPECIFIC_NAME AS [name] FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE='FUNCTION' ORDER BY SPECIFIC_SCHEMA, SPECIFIC_NAME`
        };
        const apply = (rows, g) => {
            const gf = this._filters[g].get(dbName) || '';
            return rows
                .filter(r => (gf ? `${r.schema}.${r.name}`.toLowerCase().includes(gf) : true))
                .filter(r => (dbFilter ? `${r.schema}.${r.name}`.toLowerCase().includes(dbFilter) : true))
                .map(r => `${r.schema}.${r.name}`);
        };
        const gather = async (g) => {
            const res = await pool.request().query(sqlFor[g]);
            return apply(res.recordset, g);
        };
        let groups = [];
        if (kind === 'db' || kind === 'database') {
            groups = ['tables', 'procedures', 'views', 'functions'];
        } else {
            groups = [kind];
        }
        let md = `# Filter Results for ${dbName}\n\n`;
        for (const g of groups) {
            const list = await gather(g);
            if (!list.length) { continue; }
            const title = g === 'tables' ? 'Tables' : g === 'procedures' ? 'Stored Procedures' : g === 'views' ? 'Views' : 'Functions';
            md += `## ${title} (${list.length})\n` + list.map(n => `- ${n}`).join('\n') + '\n\n';
        }
        if (md.trim() === `# Filter Results for ${dbName}`) {
            md += 'No results.';
        }
        return md;
    }

    async getChildren(element) {
        const cm = this.connectionManager;
        if (!element) {
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
            // Extract connection ID from element.id
            const connectionId = String(element.id).split('|')[1];
            
            // Only show databases if this connection is active/connected
            const isConnected = this.connectionManager.active && this.connectionManager.active.id === connectionId;
            if (!isConnected) {
                const connectItem = new vscode.TreeItem('Click to connect', vscode.TreeItemCollapsibleState.None);
                connectItem.iconPath = new vscode.ThemeIcon('plug');
                connectItem.command = { command: 'mssql-explorer.connect', title: 'Connect', arguments: [{ connectionId: connectionId }] };
                return [connectItem];
            }
            
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
                const dbName = row.name;
                const item = new vscode.TreeItem(dbName, vscode.TreeItemCollapsibleState.Collapsed);
                item.contextValue = this._filters.database.has(dbName) ? 'databaseFiltered' : 'database';
                item.id = `db|${dbName}`;
                const dFilter = this._filters.database.get(dbName);
                item.description = dFilter ? `filter: ${dFilter}` : undefined;
                item.tooltip = dFilter ? `DB Filter: ${dFilter}` : undefined;
                return item;
            });
        }

        if (element.contextValue === 'database' || element.contextValue === 'databaseFiltered') {
            const dbName = String(element.id).split('|')[1];
            const dbFilter = this._filters.database.get(dbName);
            
            // If database filter is applied, show count badges and hide search/refresh buttons
            if (dbFilter) {
                return await this._getFilteredDatabaseItems(dbName, dbFilter);
            }
            
            // Normal view without database filter
            const tables = new vscode.TreeItem('Tables', vscode.TreeItemCollapsibleState.Collapsed);
            tables.iconPath = new vscode.ThemeIcon('table');
            tables.contextValue = this._filters.tables.has(dbName) ? 'tablesFiltered' : 'tables';
            tables.id = `tables|${dbName}`;
            const tFilter = this._filters.tables.get(dbName);
            tables.description = tFilter ? `filter: ${tFilter}` : undefined;
            tables.tooltip = tFilter ? `Filter: ${tFilter}` : undefined;

            const views = new vscode.TreeItem('Views', vscode.TreeItemCollapsibleState.Collapsed);
            views.iconPath = new vscode.ThemeIcon('eye');
            views.contextValue = this._filters.views.has(dbName) ? 'viewsFiltered' : 'views';
            views.id = `views|${dbName}`;
            const vFilter = this._filters.views.get(dbName);
            views.description = vFilter ? `filter: ${vFilter}` : undefined;
            views.tooltip = vFilter ? `Filter: ${vFilter}` : undefined;

            const procs = new vscode.TreeItem('Stored Procedures', vscode.TreeItemCollapsibleState.Collapsed);
            procs.iconPath = new vscode.ThemeIcon('gear');
            procs.contextValue = this._filters.procedures.has(dbName) ? 'proceduresFiltered' : 'procedures';
            procs.id = `procedures|${dbName}`;
            const pFilter = this._filters.procedures.get(dbName);
            procs.description = pFilter ? `filter: ${pFilter}` : undefined;
            procs.tooltip = pFilter ? `Filter: ${pFilter}` : undefined;

            const funcs = new vscode.TreeItem('Functions', vscode.TreeItemCollapsibleState.Collapsed);
            funcs.iconPath = new vscode.ThemeIcon('symbol-function');
            funcs.contextValue = this._filters.functions.has(dbName) ? 'functionsFiltered' : 'functions';
            funcs.id = `functions|${dbName}`;
            const fFilter = this._filters.functions.get(dbName);
            funcs.description = fFilter ? `filter: ${fFilter}` : undefined;
            funcs.tooltip = fFilter ? `Filter: ${fFilter}` : undefined;

            return [tables, views, procs, funcs];
        }

        const active = this.connectionManager.active;
        if (!active) { return []; }

        const applyDbFilter = (dbName, label) => {
            const dbFilter = this._filters.database.get(dbName);
            if (!dbFilter) { return true; }
            return label.toLowerCase().includes(dbFilter);
        };

        if (element.contextValue === 'tables' || element.contextValue === 'tablesFiltered') {
            const request = active.pool.request();
            const dbName = String(element.id).split('|')[1];
            const result = await request.query(`USE [${dbName}]; SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME`);
            let rows = result.recordset;
            const filter = this._filters.tables.get(dbName);
            if (filter) { rows = rows.filter(r => `${r.TABLE_SCHEMA}.${r.TABLE_NAME}`.toLowerCase().includes(filter)); }
            rows = rows.filter(r => applyDbFilter(dbName, `${r.TABLE_SCHEMA}.${r.TABLE_NAME}`));
            const header = new vscode.TreeItem(`(${rows.length})`, vscode.TreeItemCollapsibleState.None);
            header.iconPath = new vscode.ThemeIcon('list-ordered');
            header.contextValue = 'info';
            header.tooltip = `${rows.length} tables` + (filter || this._filters.database.get(dbName) ? ` (filtered)` : '');
            const items = rows.map(row => this._asLeaf(`${row.TABLE_SCHEMA}.${row.TABLE_NAME}`, 'table', 'table', dbName, row.TABLE_SCHEMA, row.TABLE_NAME));
            return [header, ...items];
        }

        if (element.contextValue === 'views' || element.contextValue === 'viewsFiltered') {
            const request = active.pool.request();
            const dbName = String(element.id).split('|')[1];
            const result = await request.query(`USE [${dbName}]; SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS ORDER BY TABLE_SCHEMA, TABLE_NAME`);
            let rows = result.recordset;
            const filter = this._filters.views.get(dbName);
            if (filter) { rows = rows.filter(r => `${r.TABLE_SCHEMA}.${r.TABLE_NAME}`.toLowerCase().includes(filter)); }
            rows = rows.filter(r => applyDbFilter(dbName, `${r.TABLE_SCHEMA}.${r.TABLE_NAME}`));
            const header = new vscode.TreeItem(`(${rows.length})`, vscode.TreeItemCollapsibleState.None);
            header.iconPath = new vscode.ThemeIcon('list-ordered');
            header.contextValue = 'info';
            header.tooltip = `${rows.length} views` + (filter || this._filters.database.get(dbName) ? ` (filtered)` : '');
            const items = rows.map(row => this._asLeaf(`${row.TABLE_SCHEMA}.${row.TABLE_NAME}`, 'view', 'eye', dbName, row.TABLE_SCHEMA, row.TABLE_NAME));
            return [header, ...items];
        }

        if (element.contextValue === 'procedures' || element.contextValue === 'proceduresFiltered') {
            const request = active.pool.request();
            const dbName = String(element.id).split('|')[1];
            const result = await request.query(`USE [${dbName}]; SELECT SPECIFIC_SCHEMA AS [schema], SPECIFIC_NAME AS [name] FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE='PROCEDURE' ORDER BY SPECIFIC_SCHEMA, SPECIFIC_NAME`);
            let rows = result.recordset;
            const filter = this._filters.procedures.get(dbName);
            if (filter) { rows = rows.filter(r => `${r.schema}.${r.name}`.toLowerCase().includes(filter)); }
            rows = rows.filter(r => applyDbFilter(dbName, `${r.schema}.${r.name}`));
            const header = new vscode.TreeItem(`(${rows.length})`, vscode.TreeItemCollapsibleState.None);
            header.iconPath = new vscode.ThemeIcon('list-ordered');
            header.contextValue = 'info';
            header.tooltip = `${rows.length} procedures` + (filter || this._filters.database.get(dbName) ? ` (filtered)` : '');
            const items = rows.map(row => this._asLeaf(`${row.schema}.${row.name}`, 'storedProcedure', 'gear', dbName, row.schema, row.name));
            return [header, ...items];
        }

        if (element.contextValue === 'functions' || element.contextValue === 'functionsFiltered') {
            const request = active.pool.request();
            const dbName = String(element.id).split('|')[1];
            const result = await request.query(`USE [${dbName}]; SELECT SPECIFIC_SCHEMA AS [schema], SPECIFIC_NAME AS [name] FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE='FUNCTION' ORDER BY SPECIFIC_SCHEMA, SPECIFIC_NAME`);
            let rows = result.recordset;
            const filter = this._filters.functions.get(dbName);
            if (filter) { rows = rows.filter(r => `${r.schema}.${r.name}`.toLowerCase().includes(filter)); }
            rows = rows.filter(r => applyDbFilter(dbName, `${r.schema}.${r.name}`));
            const header = new vscode.TreeItem(`(${rows.length})`, vscode.TreeItemCollapsibleState.None);
            header.iconPath = new vscode.ThemeIcon('list-ordered');
            header.contextValue = 'info';
            header.tooltip = `${rows.length} functions` + (filter || this._filters.database.get(dbName) ? ` (filtered)` : '');
            const items = rows.map(row => this._asLeaf(`${row.schema}.${row.name}`, 'function', 'symbol-function', dbName, row.schema, row.name));
            return [header, ...items];
        }

        return [];
    }

    _asConnectionItem(connection) {
        const isConnected = this.connectionManager.active && this.connectionManager.active.id === connection.id;
        const item = new vscode.TreeItem(
            connection.name || connection.config.server, 
            vscode.TreeItemCollapsibleState.Collapsed
        );
        
        item.contextValue = 'connection';
        item.id = `conn|${connection.id}`;
        item.description = isConnected ? 'connected' : 'disconnected';
        
        // Set context for when conditions
        vscode.commands.executeCommand('setContext', 'mssqlConnections.isConnected', isConnected);

        return item;
    }

    async _getFilteredDatabaseItems(dbName, dbFilter) {
        const active = this.connectionManager.active;
        if (!active) { return []; }

        const applyDbFilter = (label) => {
            return label.toLowerCase().includes(dbFilter);
        };

        // Get counts for each object type
        const [tablesCount, viewsCount, proceduresCount, functionsCount] = await Promise.all([
            this._getFilteredCount(dbName, 'tables', dbFilter),
            this._getFilteredCount(dbName, 'views', dbFilter),
            this._getFilteredCount(dbName, 'procedures', dbFilter),
            this._getFilteredCount(dbName, 'functions', dbFilter)
        ]);

        // Create items with count badges (no search/refresh buttons)
        const tables = new vscode.TreeItem(`Tables (${tablesCount})`, vscode.TreeItemCollapsibleState.Collapsed);
        tables.iconPath = new vscode.ThemeIcon('table');
        tables.contextValue = 'tablesFiltered';
        tables.id = `tables|${dbName}`;
        tables.tooltip = `${tablesCount} tables matching "${dbFilter}"`;

        const views = new vscode.TreeItem(`Views (${viewsCount})`, vscode.TreeItemCollapsibleState.Collapsed);
        views.iconPath = new vscode.ThemeIcon('eye');
        views.contextValue = 'viewsFiltered';
        views.id = `views|${dbName}`;
        views.tooltip = `${viewsCount} views matching "${dbFilter}"`;

        const procs = new vscode.TreeItem(`Stored Procedures (${proceduresCount})`, vscode.TreeItemCollapsibleState.Collapsed);
        procs.iconPath = new vscode.ThemeIcon('gear');
        procs.contextValue = 'proceduresFiltered';
        procs.id = `procedures|${dbName}`;
        procs.tooltip = `${proceduresCount} procedures matching "${dbFilter}"`;

        const funcs = new vscode.TreeItem(`Functions (${functionsCount})`, vscode.TreeItemCollapsibleState.Collapsed);
        funcs.iconPath = new vscode.ThemeIcon('symbol-function');
        funcs.contextValue = 'functionsFiltered';
        funcs.id = `functions|${dbName}`;
        funcs.tooltip = `${functionsCount} functions matching "${dbFilter}"`;

        return [tables, views, procs, funcs];
    }

    async _getFilteredCount(dbName, objectType, dbFilter) {
        const active = this.connectionManager.active;
        if (!active) { return 0; }

        const request = active.pool.request();
        let query = '';
        
        switch (objectType) {
            case 'tables':
                query = `USE [${dbName}]; SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME`;
                break;
            case 'views':
                query = `USE [${dbName}]; SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS ORDER BY TABLE_SCHEMA, TABLE_NAME`;
                break;
            case 'procedures':
                query = `USE [${dbName}]; SELECT SPECIFIC_SCHEMA AS [schema], SPECIFIC_NAME AS [name] FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE='PROCEDURE' ORDER BY SPECIFIC_SCHEMA, SPECIFIC_NAME`;
                break;
            case 'functions':
                query = `USE [${dbName}]; SELECT SPECIFIC_SCHEMA AS [schema], SPECIFIC_NAME AS [name] FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE='FUNCTION' ORDER BY SPECIFIC_SCHEMA, SPECIFIC_NAME`;
                break;
            default:
                return 0;
        }

        try {
            const result = await request.query(query);
            let rows = result.recordset;
            
            // Apply database filter
            rows = rows.filter(r => {
                const label = objectType === 'tables' || objectType === 'views' 
                    ? `${r.TABLE_SCHEMA}.${r.TABLE_NAME}`
                    : `${r.schema}.${r.name}`;
                return label.toLowerCase().includes(dbFilter);
            });
            
            return rows.length;
        } catch (error) {
            console.error(`Error getting count for ${objectType}:`, error);
            return 0;
        }
    }

    _asLeaf(label, kind, icon, databaseName, schema, name) {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.contextValue = kind;
        // item.databaseName = databaseName;
        // item.schema = schema;
        // item.name = name;
        item.command = {
            command: EXTENSION_CONFIG.COMMANDS.OPEN_OBJECT,
            title: 'Open',
            arguments: [{ databaseName, schema, name, kind }]
        };
        try {
            item.resourceUri = vscode.Uri.parse(`mssql://${encodeURIComponent(databaseName)}/${encodeURIComponent(schema)}/${encodeURIComponent(name)}`);
        } catch {}
        return item;
    }
}

module.exports = { ConnectionsTreeProvider };
