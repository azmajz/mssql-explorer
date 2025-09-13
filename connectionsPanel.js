const vscode = require('vscode');
const { EXTENSION_CONFIG } = require('./constants');

class ConnectionsPanel {
    constructor(context, connectionManager) {
        this.context = context;
        this.connectionManager = connectionManager;
        this.panel = null;
    }

    static createOrShow(context, connectionManager) {
        const panel = new ConnectionsPanel(context, connectionManager);
        panel.show();
        return panel;
    }

    show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'mssqlConnections',
            'MSSQL Connections',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getHtml();
        this.panel.onDidDispose(() => {
            this.panel = null;
        });

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'refresh':
                        this.updateConnections();
                        break;
                    case 'connect':
                        await this.connectConnection(message.connectionId);
                        break;
                    case 'disconnect':
                        await this.disconnectConnection();
                        break;
                    case 'add':
                        await this.addConnection();
                        break;
                    case 'edit':
                        await this.editConnection(message.connectionId);
                        break;
                    case 'delete':
                        await this.deleteConnection(message.connectionId);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Initial load
        this.updateConnections();
    }

    async updateConnections() {
        if (!this.panel) return;

        const connections = this.connectionManager.listConnections();
        const activeConnection = this.connectionManager.active;

        const connectionsHtml = connections.map(conn => {
            const isConnected = activeConnection && activeConnection.id === conn.id;
            return `
                <div class="connection-item ${isConnected ? 'connected' : ''}">
                    <div class="connection-header">
                        <span class="connection-name">${conn.name || conn.config.server}</span>
                        <span class="connection-status">${isConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                    <div class="connection-details">
                        <div>Server: ${conn.config.server}</div>
                        ${conn.config.database ? `<div>Database: ${conn.config.database}</div>` : ''}
                        <div>User: ${conn.config.user || 'Windows Authentication'}</div>
                    </div>
                    <div class="connection-actions">
                        ${isConnected ? 
                            `<button onclick="disconnect()" class="btn btn-secondary">Disconnect</button>` :
                            `<button onclick="connect('${conn.id}')" class="btn btn-primary">Connect</button>`
                        }
                        <button onclick="edit('${conn.id}')" class="btn btn-outline">Edit</button>
                        <button onclick="deleteConn('${conn.id}')" class="btn btn-danger">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        const html = this.getHtml(connectionsHtml);
        this.panel.webview.html = html;
    }

    getHtml(connectionsHtml = '') {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MSSQL Connections</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .title {
            font-size: 18px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .btn {
            padding: 6px 12px;
            border: 1px solid var(--vscode-button-border);
            border-radius: 2px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-size: var(--vscode-font-size);
            margin-right: 8px;
            margin-bottom: 4px;
        }
        
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-outline {
            background-color: transparent;
            color: var(--vscode-foreground);
        }
        
        .btn-danger {
            background-color: var(--vscode-button-background);
            color: var(--vscode-errorForeground);
        }
        
        .connection-item {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 16px;
            margin-bottom: 12px;
            background-color: var(--vscode-editor-background);
        }
        
        .connection-item.connected {
            border-color: var(--vscode-charts-green);
        }
        
        .connection-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .connection-name {
            font-weight: 600;
            font-size: 16px;
        }
        
        .connection-status {
            font-size: 12px;
            padding: 2px 8px;
            border-radius: 12px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        
        .connection-item.connected .connection-status {
            background-color: var(--vscode-charts-green);
            color: var(--vscode-editor-background);
        }
        
        .connection-details {
            margin-bottom: 12px;
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
        }
        
        .connection-details div {
            margin-bottom: 4px;
        }
        
        .connection-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }
        
        .empty-state h3 {
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">MSSQL Connections</div>
        <div>
            <button onclick="refresh()" class="btn btn-outline">Refresh</button>
            <button onclick="add()" class="btn btn-primary">Add Connection</button>
        </div>
    </div>
    
    <div id="connections">
        ${connectionsHtml || `
            <div class="empty-state">
                <h3>No Connections</h3>
                <p>Click "Add Connection" to create your first database connection.</p>
            </div>
        `}
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
        
        function connect(connectionId) {
            vscode.postMessage({ command: 'connect', connectionId });
        }
        
        function disconnect() {
            vscode.postMessage({ command: 'disconnect' });
        }
        
        function add() {
            vscode.postMessage({ command: 'add' });
        }
        
        function edit(connectionId) {
            vscode.postMessage({ command: 'edit', connectionId });
        }
        
        function deleteConn(connectionId) {
            vscode.postMessage({ command: 'delete', connectionId });
        }
    </script>
</body>
</html>`;
    }

    async connectConnection(connectionId) {
        const connection = this.connectionManager.listConnections().find(c => c.id === connectionId);
        if (!connection) {
            vscode.window.showErrorMessage('Connection not found');
            return;
        }

        try {
            await this.connectionManager.connect(connection);
            vscode.window.showInformationMessage(`Connected: ${connection.name}`);
            this.updateConnections();
        } catch (error) {
            vscode.window.showErrorMessage(`Connect failed: ${error.message}`);
        }
    }

    async disconnectConnection() {
        try {
            await this.connectionManager.disconnect();
            vscode.window.showInformationMessage('Disconnected');
            this.updateConnections();
        } catch (error) {
            vscode.window.showErrorMessage(`Disconnect failed: ${error.message}`);
        }
    }

    async addConnection() {
        // Delegate to the connection command handler
        const { ConnectionCommands } = require('./commands/connectionCommands');
        const connectionCommands = new ConnectionCommands(this.connectionManager, null);
        await connectionCommands.addConnection();
        this.updateConnections();
    }

    async editConnection(connectionId) {
        // Delegate to the connection command handler
        const { ConnectionCommands } = require('./commands/connectionCommands');
        const connectionCommands = new ConnectionCommands(this.connectionManager, null);
        await connectionCommands.editConnection({ connectionId });
        this.updateConnections();
    }

    async deleteConnection(connectionId) {
        // Delegate to the connection command handler
        const { ConnectionCommands } = require('./commands/connectionCommands');
        const connectionCommands = new ConnectionCommands(this.connectionManager, null);
        await connectionCommands.deleteConnection({ connectionId });
        this.updateConnections();
    }
}

module.exports = { ConnectionsPanel };
