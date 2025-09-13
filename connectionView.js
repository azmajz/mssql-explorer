const vscode = require('vscode');
const path = require('path');
const { EXTENSION_CONFIG } = require('./constants');

class ConnectionViewPanel {
    static panels = new Map();
    static currentPanel = undefined;

    static createOrShow(context, connectionManager, treeProvider) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
        
        if (ConnectionViewPanel.currentPanel) {
            ConnectionViewPanel.currentPanel.panel.reveal(column);
            return ConnectionViewPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            'mssqlConnectionView',
            'Add MSSQL Connection',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        // Set icon for the panel - use the MSSQL icon
        panel.iconPath = vscode.Uri.file(path.join(__dirname, 'media', 'mssql.svg'));

        ConnectionViewPanel.currentPanel = new ConnectionViewPanel(panel, context, connectionManager, treeProvider);
        return ConnectionViewPanel.currentPanel;
    }

    constructor(panel, context, connectionManager, treeProvider) {
        this.panel = panel;
        this.context = context;
        this.connectionManager = connectionManager;
        this.treeProvider = treeProvider;
        this.isTesting = false;

        this.panel.onDidDispose(() => {
            ConnectionViewPanel.currentPanel = undefined;
        });

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'testConnection':
                        await this.handleTestConnection(message.data);
                        break;
                    case 'saveConnection':
                        await this.handleSaveConnection(message.data);
                        break;
                    case 'cancel':
                        this.panel.dispose();
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        this.update();
    }

    async update() {
        this.panel.webview.html = this.getHtmlForWebview();
    }

    async handleTestConnection(data) {
        if (this.isTesting) return;

        this.isTesting = true;
        this.updateWebview({ isTesting: true, error: null, testResult: null });

        try {
            const config = this.buildConnectionConfig(data);
            await this.connectionManager.test(config);
            this.updateWebview({ 
                isTesting: false, 
                testResult: { success: true, message: 'Connection test successful!' },
                error: null 
            });
        } catch (error) {
            const errorMessage = this.getErrorMessage(error);
            this.updateWebview({ 
                isTesting: false, 
                testResult: { success: false, message: errorMessage },
                error: errorMessage 
            });
        } finally {
            // Ensure loading state is always reset
            this.isTesting = false;
        }
    }

    async handleSaveConnection(data) {
        try {
            const config = this.buildConnectionConfig(data);
            
            // Test connection first
            await this.connectionManager.test(config);
            
            // Save connection
            const id = Date.now().toString();
            await this.connectionManager.addConnection({ 
                id, 
                name: data.name, 
                config 
            });
            
            // Refresh tree and close panel
            this.treeProvider.refresh();
            this.panel.dispose();
            
            vscode.window.showInformationMessage(`Connection "${data.name}" added successfully!`);
        } catch (error) {
            const errorMessage = this.getErrorMessage(error);
            this.updateWebview({ 
                error: errorMessage,
                testResult: null 
            });
        }
    }

    buildConnectionConfig(data) {
        return {
            server: data.server,
            database: data.database || undefined,
            ...EXTENSION_CONFIG.DEFAULT_CONNECTION,
            user: data.user,
            password: data.password,
            options: {
                trustedConnection: data.trustedConnection || false,
                trustServerCertificate: data.trustServerCertificate !== false
            }
        };
    }

    getErrorMessage(error) {
        // Handle different error types
        if (typeof error === 'string') {
            return error;
        }
        
        if (error && typeof error === 'object') {
            // Check for specific error properties
            if (error.message && typeof error.message === 'string' && error.message !== '[object Object]') {
                return error.message;
            }
            
            // Handle mssql ConnectionError
            if (error.name === 'ConnectionError' || error.constructor.name === 'ConnectionError') {
                if (error.originalError) {
                    return this.getErrorMessage(error.originalError);
                }
                if (error.details) {
                    return error.details;
                }
                if (error.info) {
                    return error.info.message || error.info;
                }
                if (error.number) {
                    const sqlErrors = {
                        2: 'Server not found. Please check the server name or IP address.',
                        53: 'Network path not found. Please check the server name and network connectivity.',
                        18456: 'Login failed. Please check your username and password.',
                        18470: 'Login failed. Please check your username and password.',
                        18487: 'Login failed. Please check your username and password.',
                        18488: 'Login failed. Please check your username and password.'
                    };
                    return sqlErrors[error.number] || `SQL Server error ${error.number}`;
                }
            }
            
            if (error.code) {
                const codeMessages = {
                    'ECONNREFUSED': 'Connection refused. Please check if the server is running and the server name is correct.',
                    'ETIMEOUT': 'Connection timeout. Please check if the server is accessible and the port is correct.',
                    'ELOGIN': 'Login failed. Please check your username and password.',
                    'ENOTFOUND': 'Server not found. Please check the server name or IP address.'
                };
                return codeMessages[error.code] || `Connection error (${error.code}): ${error.message || 'Unknown error'}`;
            }
            
            // Try to extract meaningful error information
            if (error.toString && error.toString() !== '[object Object]') {
                return error.toString();
            }
            
            // Check for common error properties
            if (error.error && typeof error.error === 'string') {
                return error.error;
            }
            
            if (error.errno) {
                return `Connection error (${error.errno}): ${error.message || 'Network error'}`;
            }
        }
        
        // Fallback - return a generic message instead of [object Object]
        return 'An unknown error occurred. Please check your connection settings and try again.';
    }

    updateWebview(data) {
        this.panel.webview.postMessage(data);
    }

    getHtmlForWebview() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add MSSQL Connection</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
        }

        .header {
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header h1 {
            margin: 0;
            font-size: 24px;
            color: var(--vscode-foreground);
        }

        .header p {
            margin: 5px 0 0 0;
            color: var(--vscode-descriptionForeground);
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }

        .form-group input, .form-group select {
            width: 100%;
            padding: 10px 14px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            box-sizing: border-box;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .form-group input:focus, .form-group select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 2px var(--vscode-focusBorder)33;
        }

        .form-group input:hover, .form-group select:hover {
            border-color: var(--vscode-input-border);
        }

        .form-group input[type="password"] {
            font-family: monospace;
        }

        .form-group input[type="checkbox"] {
            width: auto;
            margin-right: 8px;
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }

        .checkbox-group label {
            margin: 0;
            font-weight: normal;
            cursor: pointer;
        }

        .required {
            color: var(--vscode-errorForeground);
        }

        .error {
            background: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 12px 16px;
            border-radius: 4px;
            margin-bottom: 20px;
            display: none;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        .error.show {
            display: block;
            animation: slideDown 0.3s ease-out;
        }

        .error::before {
            content: "⚠️";
            margin-right: 8px;
            font-size: 16px;
        }

        .success {
            background: var(--vscode-inputValidation-infoBackground);
            color: var(--vscode-inputValidation-infoForeground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            padding: 12px 16px;
            border-radius: 4px;
            margin-bottom: 20px;
            display: none;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        .success.show {
            display: block;
            animation: slideDown 0.3s ease-out;
        }

        .success::before {
            content: "✅";
            margin-right: 8px;
            font-size: 16px;
        }

        .error .close-btn, .success .close-btn {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: inherit;
            cursor: pointer;
            font-size: 18px;
            font-weight: bold;
            opacity: 0.7;
            padding: 4px;
            line-height: 1;
        }

        .error .close-btn:hover, .success .close-btn:hover {
            opacity: 1;
        }


        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .button-group {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }

        .btn {
            padding: 10px 18px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            font-weight: 600;
            transition: all 0.2s ease;
            min-width: 120px;
            position: relative;
            overflow: hidden;
        }

        .btn:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }

        .btn:active:not(:disabled) {
            transform: translateY(0);
        }

        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .btn-primary:hover:not(:disabled) {
            background: var(--vscode-button-hoverBackground);
        }

        .btn-primary:disabled {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
        }

        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .btn-test {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            margin-right: auto;
        }

        .btn-test:hover:not(:disabled) {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .btn-test:disabled {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
        }

        .loading {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid var(--vscode-progressBar-background);
            border-radius: 50%;
            border-top-color: var(--vscode-progressBar-foreground);
            animation: spin 1s ease-in-out infinite;
            margin-right: 8px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Add MSSQL Connection</h1>
            <p>Configure a new SQL Server database connection</p>
        </div>

        <div class="error" id="errorMessage">
            <button class="close-btn" onclick="clearMessages()">&times;</button>
        </div>
        <div class="success" id="successMessage">
            <button class="close-btn" onclick="clearMessages()">&times;</button>
        </div>


        <form id="connectionForm">
            <div class="form-group">
                <label for="name">Connection Name <span class="required">*</span></label>
                <input type="text" id="name" name="name" value="MSSQL" required>
                <div class="help-text">A friendly name to identify this connection</div>
            </div>

        <div class="form-group">
            <label for="server">Server <span class="required">*</span></label>
            <input type="text" id="server" name="server" placeholder="localhost\\SQLEXPRESS" required>
            <div class="help-text">Server name or IP address (e.g., localhost\\SQLEXPRESS, 192.168.1.100, server.domain.com)</div>
        </div>

        <div class="form-group">
            <label for="port">Port</label>
            <input type="number" id="port" name="port" placeholder="1433" value="1433">
            <div class="help-text">SQL Server port (default: 1433)</div>
        </div>

            <div class="form-group">
                <label for="database">Database</label>
                <input type="text" id="database" name="database" placeholder="master">
                <div class="help-text">Database name (optional, will connect to default database if not specified)</div>
            </div>

            <div class="form-group">
                <label for="authType">Authentication</label>
                <select id="authType" name="authType">
                    <option value="sql">SQL Server Authentication</option>
                    <option value="windows">Windows Authentication</option>
                </select>
            </div>

            <div id="sqlAuthFields">
                <div class="form-group">
                    <label for="user">Username <span class="required">*</span></label>
                    <input type="text" id="user" name="user" value="sa">
                </div>

                <div class="form-group">
                    <label for="password">Password <span class="required">*</span></label>
                    <input type="password" id="password" name="password">
                </div>
            </div>

            <div class="form-group">
                <div class="checkbox-group">
                    <input type="checkbox" id="trustServerCertificate" name="trustServerCertificate" checked>
                    <label for="trustServerCertificate">Trust Server Certificate</label>
                </div>
                <div class="help-text">Skip certificate validation (useful for self-signed certificates)</div>
            </div>
        </form>

        <div class="button-group">
            <button type="button" class="btn btn-test" id="testBtn">
                <span class="loading" id="testLoading" style="display: none;"></span>
                <span id="testText">Test Connection</span>
            </button>
            <button type="button" class="btn btn-secondary" id="cancelBtn">Cancel</button>
            <button type="button" class="btn btn-primary" id="saveBtn">Save Connection</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Form elements
        const form = document.getElementById('connectionForm');
        const authType = document.getElementById('authType');
        const sqlAuthFields = document.getElementById('sqlAuthFields');
        const testBtn = document.getElementById('testBtn');
        const saveBtn = document.getElementById('saveBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const errorDiv = document.getElementById('errorMessage');
        const successDiv = document.getElementById('successMessage');
        const testLoading = document.getElementById('testLoading');
        const testText = document.getElementById('testText');

        // Authentication type change handler
        authType.addEventListener('change', function() {
            if (this.value === 'windows') {
                sqlAuthFields.style.display = 'none';
                document.getElementById('user').required = false;
                document.getElementById('password').required = false;
            } else {
                sqlAuthFields.style.display = 'block';
                document.getElementById('user').required = true;
                document.getElementById('password').required = true;
            }
        });

        // Test connection handler
        testBtn.addEventListener('click', async function() {
            const formData = getFormData();
            if (!validateForm(formData)) return;

            vscode.postMessage({
                command: 'testConnection',
                data: formData
            });
        });

        // Save connection handler
        saveBtn.addEventListener('click', async function() {
            const formData = getFormData();
            if (!validateForm(formData)) return;

            vscode.postMessage({
                command: 'saveConnection',
                data: formData
            });
        });

        // Cancel handler
        cancelBtn.addEventListener('click', function() {
            vscode.postMessage({
                command: 'cancel'
            });
        });

        // Form validation
        function validateForm(data) {
            clearMessages();

            if (!data.name.trim()) {
                showError('Connection name is required');
                return false;
            }

            if (!data.server.trim()) {
                showError('Server is required');
                return false;
            }

            if (data.authType === 'sql') {
                if (!data.user.trim()) {
                    showError('Username is required for SQL Server authentication');
                    return false;
                }
                if (!data.password) {
                    showError('Password is required for SQL Server authentication');
                    return false;
                }
            }

            return true;
        }

        // Get form data
        function getFormData() {
            const formData = new FormData(form);
            const port = formData.get('port');
            let server = formData.get('server');
            
            // Append port to server if specified and not already included
            if (port && port !== '1433' && !server.includes(',')) {
                server = server + ',' + port;
            }
            
            return {
                name: formData.get('name'),
                server: server,
                database: formData.get('database'),
                authType: formData.get('authType'),
                user: formData.get('user'),
                password: formData.get('password'),
                trustedConnection: formData.get('authType') === 'windows',
                trustServerCertificate: formData.get('trustServerCertificate') === 'on'
            };
        }

        // Show error message
        function showError(message) {
            errorDiv.innerHTML = message + '<button class="close-btn" onclick="clearMessages()">&times;</button>';
            errorDiv.classList.add('show');
            successDiv.classList.remove('show');
        }

        // Show success message
        function showSuccess(message) {
            successDiv.innerHTML = message + '<button class="close-btn" onclick="clearMessages()">&times;</button>';
            successDiv.classList.add('show');
            errorDiv.classList.remove('show');
        }

        // Clear messages
        function clearMessages() {
            errorDiv.classList.remove('show');
            successDiv.classList.remove('show');
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            if (message.isTesting !== undefined) {
                testBtn.disabled = message.isTesting;
                saveBtn.disabled = message.isTesting;
                testLoading.style.display = message.isTesting ? 'inline-block' : 'none';
                testText.textContent = message.isTesting ? 'Testing...' : 'Test Connection';
            }

            // Clear previous messages when starting test
            if (message.isTesting) {
                clearMessages();
            }

            // Handle error messages
            if (message.error) {
                showError(message.error);
            }

            // Handle test results
            if (message.testResult) {
                if (message.testResult.success) {
                    showSuccess(message.testResult.message);
                } else {
                    showError(message.testResult.message);
                }
            }
        });

        // Initialize form
        authType.dispatchEvent(new Event('change'));
    </script>
</body>
</html>`;
    }
}

module.exports = { ConnectionViewPanel };
