const vscode = require('vscode');

class SidebarPanel {
    static currentPanel = undefined;

    static createOrShow(context) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (SidebarPanel.currentPanel) {
            SidebarPanel.currentPanel.panel.reveal(column);
            return SidebarPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            'mssqlSidebar',
            'MSSQL Explorer',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        SidebarPanel.currentPanel = new SidebarPanel(panel, context);
        return SidebarPanel.currentPanel;
    }

    constructor(panel, context) {
        this.panel = panel;
        this.context = context;
        this.connectionConfig = null;
        this.connectionPool = null;
        this.selectedDatabase = null;
        this.availableDatabases = [];
        this.availableSchemas = [];
        this.filteredSchemas = [];
        this.mainContentPanel = null;

        this.panel.webview.html = this.getWebviewContent();

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'connect':
                        await this.handleConnect();
                        break;
                    case 'disconnect':
                        await this.handleDisconnect();
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
                }
            }
        );

        this.panel.onDidDispose(() => {
            SidebarPanel.currentPanel = undefined;
        });
    }

    getWebviewContent() {
        const isConnected = this.connectionPool !== null;
        const serverInfo = isConnected ? `${this.connectionConfig.server}` : '';
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>MSSQL Explorer</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background: var(--vscode-sideBar-background);
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    overflow: hidden;
                }
                
                #menu {
                    padding: 16px;
                    height: calc(100vh - 32px);
                    overflow-y: auto;
                    background: var(--vscode-sideBar-background);
                }
                
                h1 {
                    margin: 0 0 16px 0;
                    font-size: 16px;
                    color: var(--vscode-sideBarTitle-foreground);
                    font-weight: 600;
                }
                
                h1 a {
                    color: var(--vscode-sideBarTitle-foreground);
                    text-decoration: none;
                }
                
                .version {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-left: 4px;
                }
                
                .connect-section {
                    margin-bottom: 16px;
                }
                
                .connect-btn {
                    width: 100%;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 12px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                }
                
                .connect-btn:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                
                .disconnect-btn {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    padding: 4px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                    margin-left: 8px;
                }
                
                .disconnect-btn:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
                
                .connection-info {
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    padding: 8px 12px;
                    border-radius: 3px;
                    margin-bottom: 12px;
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .database-selector {
                    margin-bottom: 12px;
                }
                
                .database-selector label {
                    display: block;
                    margin-bottom: 4px;
                    font-weight: 500;
                    font-size: 11px;
                    color: var(--vscode-foreground);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .database-selector select {
                    width: 100%;
                    padding: 6px 8px;
                    background: var(--vscode-dropdown-background);
                    color: var(--vscode-dropdown-foreground);
                    border: 1px solid var(--vscode-dropdown-border);
                    border-radius: 3px;
                    font-size: 12px;
                    box-sizing: border-box;
                }
                
                .database-selector select:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }
                
                .links {
                    margin: 12px 0;
                }
                
                .links a {
                    display: block;
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                    padding: 4px 0;
                    font-size: 12px;
                    cursor: pointer;
                    border-radius: 3px;
                    padding-left: 8px;
                    margin: 2px 0;
                }
                
                .links a:hover {
                    background: var(--vscode-list-hoverBackground);
                    text-decoration: none;
                }
                
                #filter-schema-container {
                    margin-bottom: 12px;
                }
                
                #filter-schema-input {
                    width: 100%;
                    padding: 6px 8px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 3px;
                    font-size: 12px;
                    box-sizing: border-box;
                }
                
                #filter-schema-input:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }
                
                #filter-schema-count {
                    font-size: 10px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }
                
                #db_schemas {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    max-height: 400px;
                    overflow-y: auto;
                }
                
                #db_schemas li {
                    margin: 0;
                    padding: 0;
                }
                
                #db_schemas li a {
                    display: block;
                    padding: 6px 12px;
                    color: var(--vscode-foreground);
                    text-decoration: none;
                    font-size: 12px;
                    cursor: pointer;
                    border-radius: 3px;
                    margin: 1px 0;
                    position: relative;
                }
                
                #db_schemas li a:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                
                #db_schemas li a.selected {
                    background: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                }
                
                #db_schemas li a.selected::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 3px;
                    background: var(--vscode-foreground);
                }
                
                .hidden {
                    display: none;
                }
            </style>
        </head>
        <body>
            <div id="menu">
                <h1>
                    <a href="#" id="h1">MSSQL Explorer</a> <span class="version">1.0.0</span>
                </h1>
                
                ${!isConnected ? `
                    <div class="connect-section">
                        <button class="connect-btn" onclick="connect()">Connect to Database</button>
                    </div>
                ` : `
                    <div class="connection-info">
                        Connected to: ${serverInfo}
                        <button class="disconnect-btn" onclick="disconnect()">Disconnect</button>
                    </div>
                    
                    <form id="menu-selectors">
                        <div class="database-selector">
                            <label for="db-select">Database</label>
                            <select id="db-select" onchange="selectDatabase(this.value)">
                                <option value="">Select Database</option>
                                ${this.availableDatabases.map(db => 
                                    `<option value="${db}" ${db === this.selectedDatabase ? 'selected' : ''}>${db}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </form>
                    
                    <div class="links">
                        <a href="#" onclick="executeQuery()">SQL Command</a>
                        <a href="#" onclick="showTables()">Tables</a>
                        <a href="#" onclick="showRoutines()">Routines</a>
                        <a href="#" onclick="showViews()">Views</a>
                        <a href="#" onclick="showFunctions()">Functions</a>
                    </div>
                    
                    ${this.selectedDatabase ? `
                        <div id="filter-schema-container">
                            <input type="search" id="filter-schema-input" placeholder="Search in ${this.availableSchemas.length} schemas..." 
                                   value="" onkeyup="filterSchemas(this.value)">
                            <div id="filter-schema-count">${this.filteredSchemas.length} schemas</div>
                        </div>
                        
                        <ul id="db_schemas">
                            ${this.filteredSchemas.map(schema => `
                                <li class="filter-schema-name">
                                    <a href="#" class="select" onclick="selectSchema('${schema}')" title="Select schema">${schema}</a>
                                </li>
                            `).join('')}
                        </ul>
                    ` : ''}
                `}
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function connect() {
                    vscode.postMessage({ command: 'connect' });
                }
                
                function disconnect() {
                    vscode.postMessage({ command: 'disconnect' });
                }
                
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
                    document.querySelectorAll('#db_schemas a').forEach(a => a.classList.remove('selected'));
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
                
                // Debounce function for search
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
                
                // Apply debounce to filterSchemas
                const debouncedFilterSchemas = debounce(filterSchemas, 300);
                document.getElementById('filter-schema-input').onkeyup = (e) => debouncedFilterSchemas(e.target.value);
            </script>
        </body>
        </html>`;
    }

    async handleConnect() {
        // Open connection dialog
        const { ConnectionDialogPanel } = require('./connectionDialog');
        ConnectionDialogPanel.createOrShow(this.context);
    }

    async handleDisconnect() {
        try {
            if (this.connectionPool) {
                await this.connectionPool.close();
                this.connectionPool = null;
                this.connectionConfig = null;
                this.selectedDatabase = null;
                this.availableDatabases = [];
                this.availableSchemas = [];
                this.filteredSchemas = [];
                this.panel.webview.html = this.getWebviewContent();
                vscode.window.showInformationMessage('Disconnected from database');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Disconnect failed: ${error.message}`);
        }
    }

    async handleSelectDatabase(database) {
        if (!this.connectionPool) {
            vscode.window.showErrorMessage('Please connect to a database first');
            return;
        }

        this.selectedDatabase = database;
        await this.loadSchemas(database);
        this.panel.webview.html = this.getWebviewContent();
    }

    async loadSchemas(databaseName) {
        try {
            const request = this.connectionPool.request();
            const result = await request.query(`USE [${databaseName}]; SELECT name FROM sys.schemas ORDER BY name`);
            this.availableSchemas = result.recordset.map(schema => schema.name);
            this.filteredSchemas = [...this.availableSchemas];
        } catch (error) {
            console.error('Error loading schemas:', error);
            vscode.window.showErrorMessage(`Error loading schemas: ${error.message}`);
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
        // Create or show main content panel
        if (!this.mainContentPanel) {
            const { MainContentPanel } = require('./mainContentPanel');
            this.mainContentPanel = MainContentPanel.createOrShow(this.context, this.connectionConfig, this.connectionPool);
        } else {
            this.mainContentPanel.panel.reveal();
        }
        
        // Load schema content in main panel
        await this.mainContentPanel.handleLoadSchemaContent(this.selectedDatabase, schema);
    }

    // Method to update connection state from external source
    updateConnectionState(config, pool) {
        this.connectionConfig = config;
        this.connectionPool = pool;
        this.loadDatabases();
    }

    async loadDatabases() {
        try {
            const request = this.connectionPool.request();
            const result = await request.query('SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name');
            this.availableDatabases = result.recordset.map(db => db.name);
            this.panel.webview.html = this.getWebviewContent();
        } catch (error) {
            console.error('Error loading databases:', error);
            vscode.window.showErrorMessage(`Error loading databases: ${error.message}`);
        }
    }
}

module.exports = { SidebarPanel };