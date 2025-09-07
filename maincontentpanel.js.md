const vscode = require('vscode');

class MainContentPanel {
    static currentPanel = undefined;

    static createOrShow(context, connectionConfig, connectionPool, database = null, schema = null) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn + 1
            : vscode.ViewColumn.Two;

        if (MainContentPanel.currentPanel) {
            MainContentPanel.currentPanel.panel.reveal(column);
            if (database) {
                MainContentPanel.currentPanel.handleSelectDatabase(database);
            }
            if (database && schema) {
                MainContentPanel.currentPanel.handleLoadSchemaContent(database, schema);
            }
            return MainContentPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            'mssqlMainContent',
            'MSSQL Database Content',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        MainContentPanel.currentPanel = new MainContentPanel(panel, context, connectionConfig, connectionPool);
        
        // Load available databases when panel is created
        MainContentPanel.currentPanel.loadAvailableDatabases().then(() => {
            if (database) {
                MainContentPanel.currentPanel.handleSelectDatabase(database);
            }
            if (database && schema) {
                MainContentPanel.currentPanel.handleLoadSchemaContent(database, schema);
            }
        });
        
        return MainContentPanel.currentPanel;
    }

    constructor(panel, context, connectionConfig, connectionPool) {
        this.panel = panel;
        this.context = context;
        this.connectionConfig = connectionConfig;
        this.connectionPool = connectionPool;
        this.selectedDatabase = null;
        this.selectedSchema = null;
        this.availableDatabases = [];
        this.availableSchemas = [];
        this.filteredSchemas = [];
        this.tables = [];
        this.views = [];
        this.routines = [];

        // Load databases immediately if we have a connection
        if (this.connectionPool) {
            this.loadAvailableDatabases().then(() => {
                this.panel.webview.html = this.getWebviewContent();
            });
        } else {
            this.panel.webview.html = this.getWebviewContent();
        }

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'loadSchemaContent':
                        await this.handleLoadSchemaContent(message.database, message.schema);
                        break;
                    case 'selectDatabase':
                        await this.handleSelectDatabase(message.database);
                        break;
                    case 'filterSchemas':
                        this.handleFilterSchemas(message.searchTerm);
                        break;
                    case 'selectSchema':
                        await this.handleSelectSchema(message.schema);
                        break;
                    case 'openTable':
                        await this.handleOpenTable(message.database, message.schema, message.table);
                        break;
                    case 'openView':
                        await this.handleOpenView(message.database, message.schema, message.view);
                        break;
                    case 'openRoutine':
                        await this.handleOpenRoutine(message.database, message.schema, message.routine);
                        break;
                }
            }
        );

        this.panel.onDidDispose(() => {
            MainContentPanel.currentPanel = undefined;
        });
    }

    getWebviewContent() {
        const breadcrumb = this.getBreadcrumb();
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>MSSQL Database Content</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    overflow: hidden;
                }
                
                .adminer-layout {
                    display: flex;
                    height: 100vh;
                }
                
                .adminer-sidebar {
                    width: 280px;
                    background: var(--vscode-sideBar-background);
                    border-right: 1px solid var(--vscode-sideBar-border);
                    overflow-y: auto;
                    padding: 0;
                }
                
                .adminer-main {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0;
                    background: var(--vscode-editor-background);
                }
                
                .sidebar-header {
                    padding: 16px 16px 12px 16px;
                    border-bottom: 1px solid var(--vscode-sideBar-border);
                }
                
                .sidebar-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--vscode-sideBarTitle-foreground);
                    margin: 0 0 8px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .sidebar-content {
                    padding: 16px;
                }
                
                .form-group {
                    margin-bottom: 16px;
                }
                
                .form-group label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin-bottom: 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .form-group select {
                    width: 100%;
                    height: 22px;
                    padding: 0 8px;
                    font-size: 13px;
                    font-family: var(--vscode-font-family);
                    background: var(--vscode-dropdown-background);
                    color: var(--vscode-dropdown-foreground);
                    border: 1px solid var(--vscode-dropdown-border);
                    border-radius: 2px;
                    box-sizing: border-box;
                }
                
                .form-group select:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }
                
                .nav-section {
                    margin-bottom: 16px;
                }
                
                .nav-section-title {
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--vscode-sideBarTitle-foreground);
                    margin: 0 0 8px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .nav-links {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                
                .nav-links li {
                    margin: 0;
                }
                
                .nav-links a {
                    display: block;
                    padding: 6px 8px;
                    color: var(--vscode-foreground);
                    text-decoration: none;
                    font-size: 13px;
                    cursor: pointer;
                    border-radius: 2px;
                    margin: 1px 0;
                }
                
                .nav-links a:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                
                .search-container {
                    margin-bottom: 12px;
                }
                
                .search-input {
                    width: 100%;
                    height: 22px;
                    padding: 0 8px;
                    font-size: 13px;
                    font-family: var(--vscode-font-family);
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 2px;
                    box-sizing: border-box;
                }
                
                .search-input:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }
                
                .search-count {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }
                
                .schema-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    max-height: 300px;
                    overflow-y: auto;
                }
                
                .schema-list li {
                    margin: 0;
                }
                
                .schema-list a {
                    display: block;
                    padding: 6px 8px;
                    color: var(--vscode-foreground);
                    text-decoration: none;
                    font-size: 13px;
                    cursor: pointer;
                    border-radius: 2px;
                    margin: 1px 0;
                    position: relative;
                }
                
                .schema-list a:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                
                .schema-list a.selected {
                    background: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                }
                
                .schema-list a.selected::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 3px;
                    background: var(--vscode-foreground);
                }
                
                .main-content {
                    padding: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                
                .breadcrumb {
                    margin-bottom: 20px;
                    font-size: 13px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .breadcrumb a {
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                }
                
                .breadcrumb a:hover {
                    text-decoration: underline;
                }
                
                .page-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin: 0 0 20px 0;
                }
                
                .section {
                    margin-bottom: 24px;
                }
                
                .section-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin: 0 0 12px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .section-content {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 2px;
                }
                
                .section-header {
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    background: var(--vscode-panel-background);
                }
                
                .section-header-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin: 0;
                }
                
                .search-bar {
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    background: var(--vscode-input-background);
                }
                
                .search-bar input {
                    width: 300px;
                    height: 22px;
                    padding: 0 8px;
                    font-size: 13px;
                    font-family: var(--vscode-font-family);
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 2px;
                }
                
                .search-bar input:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }
                
                .search-count {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-left: 8px;
                }
                
                .table-container {
                    overflow-x: auto;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                
                th, td {
                    padding: 8px 12px;
                    text-align: left;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                
                th {
                    background: var(--vscode-panel-background);
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                tr:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                
                tr.odd {
                    background: var(--vscode-list-inactiveSelectionBackground);
                }
                
                tr.odd:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                
                a {
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                }
                
                a:hover {
                    text-decoration: underline;
                }
                
                .muted {
                    color: var(--vscode-descriptionForeground);
                }
                
                input[type="checkbox"] {
                    margin-right: 8px;
                }
                
                .select-database {
                    text-align: center;
                    padding: 60px 20px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .select-database h2 {
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin: 0 0 8px 0;
                }
                
                .select-database p {
                    font-size: 13px;
                    margin: 0 0 24px 0;
                }
                
                .database-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 12px;
                    max-width: 600px;
                    margin: 0 auto;
                }
                
                .database-card {
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 2px;
                    padding: 16px;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.2s ease;
                }
                
                .database-card:hover {
                    background: var(--vscode-list-hoverBackground);
                    border-color: var(--vscode-focusBorder);
                }
                
                .database-card h3 {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin: 0 0 4px 0;
                }
                
                .database-card p {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin: 0;
                }
            </style>
        </head>
        <body>
            ${this.selectedDatabase ? `
                <div class="adminer-layout">
                    <div class="adminer-sidebar">
                        <div class="sidebar-header">
                            <div class="sidebar-title">MSSQL Explorer</div>
                        </div>
                        
                        <div class="sidebar-content">
                            <div class="form-group">
                                <label for="db-select">Database</label>
                                <select id="db-select" onchange="selectDatabase(this.value)">
                                    <option value="">Select Database</option>
                                    ${this.availableDatabases.map(db => 
                                        `<option value="${db}" ${db === this.selectedDatabase ? 'selected' : ''}>${db}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            
                            <div class="nav-section">
                                <div class="nav-section-title">Actions</div>
                                <ul class="nav-links">
                                    <li><a href="#" onclick="executeQuery()">SQL Command</a></li>
                                    <li><a href="#" onclick="showTables()">Tables</a></li>
                                    <li><a href="#" onclick="showRoutines()">Routines</a></li>
                                    <li><a href="#" onclick="showViews()">Views</a></li>
                                    <li><a href="#" onclick="showFunctions()">Functions</a></li>
                                </ul>
                            </div>
                            
                            ${this.selectedDatabase ? `
                                <div class="nav-section">
                                    <div class="nav-section-title">Schemas</div>
                                    <div class="search-container">
                                        <input type="text" class="search-input" id="filter-schema-input" 
                                               placeholder="Search in ${this.availableSchemas.length} schemas..." 
                                               value="" onkeyup="filterSchemas(this.value)">
                                        <div class="search-count">${this.filteredSchemas.length} schemas</div>
                                    </div>
                                    
                                    <ul class="schema-list">
                                        ${this.filteredSchemas.map(schema => `
                                            <li>
                                                <a href="#" onclick="selectSchema('${schema}')" title="Select schema">${schema}</a>
                                            </li>
                                        `).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="adminer-main">
                        <div class="main-content">
                            <div class="breadcrumb">${breadcrumb}</div>
                            
                            ${this.selectedSchema ? `
                                <h1 class="page-title">Schema: ${this.selectedSchema}</h1>
                                
                                <div class="section">
                                    <div class="section-title">Tables and Views</div>
                                    <div class="section-content">
                                        <div class="section-header">
                                            <div class="section-header-title">Total Rows (${this.tables.length + this.views.length})</div>
                                        </div>
                                        <div class="search-bar">
                                            <input type="text" id="filter-table-input" placeholder="Search rows..." value="">
                                            <span class="search-count" id="filter-table-count"></span>
                                        </div>
                                        <div class="table-container">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th><input id="check-all" type="checkbox"></th>
                                                        <th>Table</th>
                                                        <th>Show structure</th>
                                                        <th>Engine</th>
                                                        <th>Collation</th>
                                                        <th>Comment</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${this.getTablesAndViewsRows()}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="section">
                                    <div class="section-title">Routines</div>
                                    <div class="section-content">
                                        <div class="table-container">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Routine Name</th>
                                                        <th>Execute Routine</th>
                                                        <th>Alter Routine</th>
                                                        <th>Created At</th>
                                                        <th>Modified At</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${this.getRoutinesRows()}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ` : `
                                <h1 class="page-title">Select a schema from the sidebar to view database objects</h1>
                            `}
                        </div>
                    </div>
                </div>
            ` : `
                <div class="select-database">
                    <h2>Select a Database</h2>
                    <p>Choose a database from the sidebar to view its contents</p>
                    
                    <div class="database-grid">
                        ${this.availableDatabases.map(db => `
                            <div class="database-card" onclick="selectDatabase('${db}')">
                                <h3>${db}</h3>
                                <p>Click to select this database</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `}
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function selectDatabase(database) {
                    if (database) {
                        vscode.postMessage({ command: 'selectDatabase', database: database });
                    }
                }
                
                function filterSchemas(searchTerm) {
                    vscode.postMessage({ command: 'filterSchemas', searchTerm: searchTerm });
                }
                
                function selectSchema(schema) {
                    vscode.postMessage({ command: 'selectSchema', schema: schema });
                    
                    // Update UI to show selected schema
                    document.querySelectorAll('.schema-list a').forEach(a => a.classList.remove('selected'));
                    event.target.classList.add('selected');
                }
                
                function executeQuery() {
                    vscode.postMessage({ command: 'executeQuery' });
                }
                
                function showTables() {
                    // Implementation for showing all tables
                }
                
                function showRoutines() {
                    // Implementation for showing all routines
                }
                
                function showViews() {
                    // Implementation for showing all views
                }
                
                function showFunctions() {
                    // Implementation for showing all functions
                }
                
                // Filter functionality for tables
                function filterTables() {
                    const searchTerm = document.getElementById('filter-table-input').value.toLowerCase();
                    const rows = document.querySelectorAll('tbody tr');
                    let visibleCount = 0;
                    
                    rows.forEach(row => {
                        const tableName = row.querySelector('th a, td a').textContent.toLowerCase();
                        if (tableName.includes(searchTerm)) {
                            row.style.display = '';
                            visibleCount++;
                        } else {
                            row.style.display = 'none';
                        }
                    });
                    
                    document.getElementById('filter-table-count').textContent = \`\${visibleCount} visible\`;
                }
                
                // Debounce function
                function debounce(func, wait) {
                    let timeout;
                    return function executedFunction(...args) {
                        const later = () => {
                            clearTimeout(timeout);
                            func(...args);
                        };
                        clearTimeout(timeout);
                        timeout = setTimeout(later, wait);
                    };
                }
                
                // Apply debounce to filters
                const debouncedFilterTables = debounce(filterTables, 300);
                const debouncedFilterSchemas = debounce(filterSchemas, 300);
                
                if (document.getElementById('filter-table-input')) {
                    document.getElementById('filter-table-input').onkeyup = debouncedFilterTables;
                }
                
                if (document.getElementById('filter-schema-input')) {
                    document.getElementById('filter-schema-input').onkeyup = (e) => debouncedFilterSchemas(e.target.value);
                }
                
                // Checkbox functionality
                if (document.getElementById('check-all')) {
                    document.getElementById('check-all').onclick = function() {
                        const checkboxes = document.querySelectorAll('input[name^="tables"], input[name^="views"]');
                        checkboxes.forEach(cb => cb.checked = this.checked);
                    };
                }
                
                // Initialize filter count
                if (document.getElementById('filter-table-input')) {
                    filterTables();
                }
            </script>
        </body>
        </html>`;
    }

    getBreadcrumb() {
        if (!this.connectionConfig) {
            return 'Not connected';
        }
        
        let breadcrumb = `<a href="#">MS SQL (beta)</a> » <a href="#" accesskey="1" title="Alt+Shift+1">${this.connectionConfig.server}</a>`;
        
        if (this.selectedDatabase) {
            breadcrumb += ` » <a href="#">${this.selectedDatabase}</a>`;
        }
        
        if (this.selectedSchema) {
            breadcrumb += ` » Schema: ${this.selectedSchema}`;
        }
        
        return breadcrumb;
    }

    getTablesAndViewsRows() {
        let rows = '';
        
        // Add tables
        this.tables.forEach((table) => {
            rows += `
                <tr>
                    <td><input type="checkbox" name="tables[]" value="${table.name}"></td>
                    <th><a href="#" onclick="openTable('${table.name}')" title="Select Data">${table.name}</a></th>
                    <th><a href="#" onclick="openTableStructure('${table.name}')" title="Show structure">Table structure</a></th>
                    <td>USER_TABLE</td>
                    <td></td>
                    <td>${table.comment || ''}</td>
                </tr>
            `;
        });
        
        // Add views
        this.views.forEach((view) => {
            rows += `
                <tr>
                    <td><input type="checkbox" name="views[]" value="${view.name}"></td>
                    <th><a href="#" onclick="openView('${view.name}')" title="Select Data">${view.name}</a></th>
                    <th><a href="#" onclick="openViewStructure('${view.name}')" title="Show structure">View structure</a></th>
                    <td colspan="2"><a href="#" onclick="openViewStructure('${view.name}')" title="Alter view">View</a></td>
                    <td>${view.comment || ''}</td>
                </tr>
            `;
        });
        
        return rows;
    }

    getRoutinesRows() {
        let rows = '';
        
        this.routines.forEach((routine, index) => {
            const isOdd = index % 2 === 1;
            rows += `
                <tr${isOdd ? ' class="odd"' : ''}>
                    <th><a href="#" onclick="openRoutine('${routine.name}')">${routine.name}</a></th>
                    <td><a href="#" onclick="executeRoutine('${routine.name}')">Execute</a></td>
                    <td><a href="#" onclick="alterRoutine('${routine.name}')">Alter</a></td>
                    <td class="muted">${routine.createdAt || ''}</td>
                    <td class="muted">${routine.modifiedAt || ''}</td>
                </tr>
            `;
        });
        
        return rows;
    }

    async handleLoadSchemaContent(database, schema) {
        this.selectedDatabase = database;
        this.selectedSchema = schema;
        
        try {
            await this.loadTablesAndViews(database, schema);
            await this.loadRoutines(database, schema);
            this.panel.webview.html = this.getWebviewContent();
        } catch (error) {
            console.error('Error loading schema content:', error);
            vscode.window.showErrorMessage(`Error loading schema content: ${error.message}`);
        }
    }

    async loadTablesAndViews(database, schema) {
        const request = this.connectionPool.request();
        
        // Load tables
        const tablesResult = await request.query(`
            USE [${database}];
            SELECT 
                t.name,
                ep.value as comment
            FROM sys.tables t 
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id 
            LEFT JOIN sys.extended_properties ep ON t.object_id = ep.major_id AND ep.minor_id = 0
            WHERE s.name = '${schema}' 
            ORDER BY t.name
        `);
        
        this.tables = tablesResult.recordset.map(table => ({
            name: table.name,
            comment: table.comment
        }));
        
        // Load views
        const viewsResult = await request.query(`
            USE [${database}];
            SELECT 
                v.name,
                ep.value as comment
            FROM sys.views v 
            INNER JOIN sys.schemas s ON v.schema_id = s.schema_id 
            LEFT JOIN sys.extended_properties ep ON v.object_id = ep.major_id AND ep.minor_id = 0
            WHERE s.name = '${schema}' 
            ORDER BY v.name
        `);
        
        this.views = viewsResult.recordset.map(view => ({
            name: view.name,
            comment: view.comment
        }));
    }

    async loadRoutines(database, schema) {
        const request = this.connectionPool.request();
        
        const routinesResult = await request.query(`
            USE [${database}];
            SELECT 
                p.name,
                p.create_date as createdAt,
                p.modify_date as modifiedAt
            FROM sys.procedures p 
            INNER JOIN sys.schemas s ON p.schema_id = s.schema_id 
            WHERE s.name = '${schema}' 
            ORDER BY p.name
        `);
        
        this.routines = routinesResult.recordset.map(routine => ({
            name: routine.name,
            createdAt: routine.createdAt ? new Date(routine.createdAt).toLocaleString() : '',
            modifiedAt: routine.modifiedAt ? new Date(routine.modifiedAt).toLocaleString() : ''
        }));
    }

    async handleOpenTable(database, schema, table) {
        const { DataViewerPanel } = require('./dataViewer');
        DataViewerPanel.createOrShow(this.context, database, schema, table, 'table', this.connectionPool);
    }

    async handleOpenView(database, schema, view) {
        const { DataViewerPanel } = require('./dataViewer');
        DataViewerPanel.createOrShow(this.context, database, schema, view, 'view', this.connectionPool);
    }

    async handleOpenRoutine(database, schema, routine) {
        const { DataViewerPanel } = require('./dataViewer');
        DataViewerPanel.createOrShow(this.context, database, schema, routine, 'storedProcedure', this.connectionPool);
    }

    // Method to update connection state
    updateConnectionState(config, pool) {
        this.connectionConfig = config;
        this.connectionPool = pool;
        this.loadAvailableDatabases();
    }

    async loadAvailableDatabases() {
        if (!this.connectionPool) return;
        
        try {
            const request = this.connectionPool.request();
            const result = await request.query(`
                SELECT name FROM sys.databases 
                WHERE database_id > 4 
                ORDER BY name
            `);
            
            this.availableDatabases = result.recordset.map(row => row.name);
            this.panel.webview.html = this.getWebviewContent();
        } catch (error) {
            console.error('Error loading databases:', error);
        }
    }

    async handleSelectDatabase(database) {
        this.selectedDatabase = database;
        this.selectedSchema = null;
        
        if (database) {
            await this.loadAvailableSchemas(database);
        }
        
        this.panel.webview.html = this.getWebviewContent();
    }

    async loadAvailableSchemas(database) {
        if (!this.connectionPool) return;
        
        try {
            const request = this.connectionPool.request();
            const result = await request.query(`
                USE [${database}];
                SELECT name FROM sys.schemas 
                ORDER BY name
            `);
            
            this.availableSchemas = result.recordset.map(row => row.name);
            this.filteredSchemas = [...this.availableSchemas];
        } catch (error) {
            console.error('Error loading schemas:', error);
        }
    }

    handleFilterSchemas(searchTerm) {
        if (!searchTerm) {
            this.filteredSchemas = [...this.availableSchemas];
        } else {
            this.filteredSchemas = this.availableSchemas.filter(schema => 
                schema.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        this.panel.webview.html = this.getWebviewContent();
    }

    async handleSelectSchema(schema) {
        this.selectedSchema = schema;
        await this.loadSchemaData(this.selectedDatabase, schema);
        this.panel.webview.html = this.getWebviewContent();
    }

    async loadSchemaData(database, schema) {
        await this.loadTablesAndViews(database, schema);
        await this.loadRoutines(database, schema);
    }
}

module.exports = { MainContentPanel };