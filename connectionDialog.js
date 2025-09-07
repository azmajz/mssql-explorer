const vscode = require('vscode');
const sql = require('mssql/msnodesqlv8');

// Global references to main extension variables
let globalTreeDataProvider = null;
let globalConnectionConfig = null;
let globalConnectionPool = null;

// Connection dialog webview panel
class ConnectionDialogPanel {
    static currentPanel = undefined;

    static createOrShow(context) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ConnectionDialogPanel.currentPanel) {
            ConnectionDialogPanel.currentPanel.panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'connectionDialog',
            'MSSQL Connection',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        ConnectionDialogPanel.currentPanel = new ConnectionDialogPanel(panel, context);
    }

    constructor(panel, context) {
        this.panel = panel;
        this.context = context;

        this.panel.webview.html = this.getWebviewContent();

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'connect':
                        await this.handleConnect(message.connectionData);
                        break;
                    case 'test':
                        await this.handleTest(message.connectionData);
                        break;
                    case 'cancel':
                        this.panel.dispose();
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        this.panel.onDidDispose(() => {
            ConnectionDialogPanel.currentPanel = undefined;
        });
    }

    getWebviewContent() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>MSSQL Connection</title>
            <style>
                body { 
                    font-family: var(--vscode-font-family); 
                    font-size: var(--vscode-font-size); 
                    color: var(--vscode-foreground); 
                    background: var(--vscode-editor-background); 
                    margin: 0; 
                    padding: 0;
                    line-height: 1.4;
                }
                
                .container {
                    padding: 20px;
                    max-width: 600px;
                    margin: 0 auto;
                }
                
                h1 {
                    font-size: 18px;
                    font-weight: 600;
                    margin: 0 0 8px 0;
                    color: var(--vscode-foreground);
                }
                
                .description {
                    font-size: 13px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 20px;
                }
                
                .form-section {
                    margin-bottom: 24px;
                }
                
                .section-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin-bottom: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .form-group {
                    margin-bottom: 16px;
                }
                
                label {
                    display: block;
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin-bottom: 6px;
                }
                
                input[type="text"], 
                input[type="password"], 
                select {
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
                
                input[type="text"]:focus, 
                input[type="password"]:focus, 
                select:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }
                
                input[type="text"]:hover, 
                input[type="password"]:hover, 
                select:hover {
                    border-color: var(--vscode-inputOption-hoverBorder);
                }
                
                .checkbox-container {
                    display: flex;
                    align-items: center;
                    margin-bottom: 8px;
                }
                
                input[type="checkbox"] {
                    width: 16px;
                    height: 16px;
                    margin-right: 8px;
                    accent-color: var(--vscode-checkbox-background);
                }
                
                .checkbox-label {
                    font-size: 13px;
                    color: var(--vscode-foreground);
                    margin-bottom: 0;
                }
                
                .button-container {
                    display: flex;
                    gap: 8px;
                    margin-top: 24px;
                }
                
                button {
                    height: 22px;
                    padding: 0 12px;
                    font-size: 13px;
                    font-family: var(--vscode-font-family);
                    border: none;
                    border-radius: 2px;
                    cursor: pointer;
                    font-weight: 400;
                }
                
                .btn-primary {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                
                .btn-primary:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                
                .btn-secondary {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                
                .btn-secondary:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
                
                .btn-test {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                
                .btn-test:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                
                .status {
                    margin-top: 16px;
                    padding: 8px 12px;
                    border-radius: 2px;
                    font-size: 13px;
                    display: none;
                    border-left: 3px solid;
                }
                
                .status.success {
                    background: var(--vscode-inputValidation-infoBackground);
                    color: var(--vscode-inputValidation-infoForeground);
                    border-left-color: var(--vscode-inputValidation-infoBorder);
                }
                
                .status.error {
                    background: var(--vscode-inputValidation-errorBackground);
                    color: var(--vscode-inputValidation-errorForeground);
                    border-left-color: var(--vscode-inputValidation-errorBorder);
                }
                
                .help-text {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>MSSQL Database Connection</h1>
                <div class="description">Connect to your MSSQL database using msnodesqlv8 driver</div>
                
                <div class="form-section">
                    <div class="section-title">Connection Details</div>
                    
                    <div class="form-group">
                        <label for="server">Server</label>
                        <input type="text" id="server" placeholder="localhost\\SQLEXPRESS" value="localhost\\SQLEXPRESS">
                        <div class="help-text">Server name with instance (e.g., localhost\\SQLEXPRESS)</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="database">Database</label>
                        <input type="text" id="database" placeholder="EZChildTrack_CustomerDB" value="EZChildTrack_CustomerDB">
                    </div>
                    
                    <div class="form-group">
                        <label for="username">Username</label>
                        <input type="text" id="username" placeholder="sa" value="sa">
                    </div>
                    
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" placeholder="Enter password" value="pAssword1">
                    </div>
                </div>

                <div class="form-section">
                    <div class="section-title">Options</div>
                    
                    <div class="checkbox-container">
                        <input type="checkbox" id="trustedConnection">
                        <label for="trustedConnection" class="checkbox-label">Trusted Connection (Windows Authentication)</label>
                    </div>
                    
                    <div class="checkbox-container">
                        <input type="checkbox" id="trustServerCertificate" checked>
                        <label for="trustServerCertificate" class="checkbox-label">Trust Server Certificate</label>
                    </div>
                </div>

                <div class="button-container">
                    <button class="btn-test" onclick="testConnection()">Test Connection</button>
                    <button class="btn-primary" onclick="connect()">Connect</button>
                    <button class="btn-secondary" onclick="cancel()">Cancel</button>
                </div>

                <div id="status" class="status"></div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function showStatus(message, type) {
                    const status = document.getElementById('status');
                    status.textContent = message;
                    status.className = 'status ' + type;
                    status.style.display = 'block';
                }

                function hideStatus() {
                    document.getElementById('status').style.display = 'none';
                }

                function getConnectionData() {
                    return {
                        server: document.getElementById('server').value,
                        database: document.getElementById('database').value,
                        user: document.getElementById('username').value,
                        password: document.getElementById('password').value,
                        options: {
                            trustedConnection: document.getElementById('trustedConnection').checked,
                            trustServerCertificate: document.getElementById('trustServerCertificate').checked
                        }
                    };
                }

                function testConnection() {
                    hideStatus();
                    showStatus('Testing connection...', 'info');
                    
                    const connectionData = getConnectionData();
                    vscode.postMessage({
                        command: 'test',
                        connectionData: connectionData
                    });
                }

                function connect() {
                    hideStatus();
                    showStatus('Connecting...', 'info');
                    
                    const connectionData = getConnectionData();
                    vscode.postMessage({
                        command: 'connect',
                        connectionData: connectionData
                    });
                }

                function cancel() {
                    vscode.postMessage({
                        command: 'cancel'
                    });
                }

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'testResult':
                            if (message.success) {
                                showStatus('Connection test successful!', 'success');
                            } else {
                                showStatus('Connection test failed: ' + message.error, 'error');
                            }
                            break;
                        case 'connectResult':
                            if (message.success) {
                                showStatus('Connected successfully!', 'success');
                                setTimeout(() => {
                                    vscode.postMessage({ command: 'cancel' });
                                }, 1000);
                            } else {
                                showStatus('Connection failed: ' + message.error, 'error');
                            }
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }

    async handleTest(connectionData) {
        try {
            const config = {
                server: connectionData.server,
                database: connectionData.database,
                driver: 'msnodesqlv8',
                options: {
                    trustedConnection: connectionData.options.trustedConnection,
                    trustServerCertificate: connectionData.options.trustServerCertificate
                },
                user: connectionData.user,
                password: connectionData.password
            };
            
            const pool = await sql.connect(config);
            await pool.close();

            this.panel.webview.postMessage({
                command: 'testResult',
                success: true
            });
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'testResult',
                success: false,
                error: error.message
            });
        }
    }

    async handleConnect(connectionData) {
        try {
            const config = {
                server: connectionData.server,
                database: connectionData.database,
                driver: 'msnodesqlv8',
                options: {
                    trustedConnection: connectionData.options.trustedConnection,
                    trustServerCertificate: connectionData.options.trustServerCertificate
                },
                user: connectionData.user,
                password: connectionData.password
            };

            globalConnectionConfig = config;
            globalConnectionPool = await sql.connect(globalConnectionConfig);
            
            // Update the main extension's variables through the global references
            const { updateConnectionState } = require('./extension');
            
            // Update the main extension's connection variables
            updateConnectionState(config, globalConnectionPool);
            
            // Update tree provider to show connection status
            if (globalTreeDataProvider) {
                globalTreeDataProvider.updateConnectionState(config, globalConnectionPool);
            }
            
            // Auto-open MSSQL Explorer after successful connection
            const { MainContentPanel } = require('./mainContentPanel');
            MainContentPanel.createOrShow(this.context, config, globalConnectionPool);
            
            this.panel.webview.postMessage({
                command: 'connectResult',
                success: true
            });
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'connectResult',
                success: false,
                error: error.message
            });
        }
    }
}

// Function to set global references from main extension
function setGlobalReferences(treeDataProvider, connectionConfig, connectionPool) {
    globalTreeDataProvider = treeDataProvider;
    globalConnectionConfig = connectionConfig;
    globalConnectionPool = connectionPool;
}

module.exports = { ConnectionDialogPanel, setGlobalReferences };
