const vscode = require('vscode');

class TestViewerPanel {
    static panels = new Map();

    static createOrShow(connectionPool, databaseName, schema, name, kind) {
        const key = `test-${databaseName}.${schema}.${name}`;
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
        
        if (TestViewerPanel.panels.has(key)) {
            const existing = TestViewerPanel.panels.get(key);
            existing.panel.reveal(column);
            return existing;
        }
        
        const panel = vscode.window.createWebviewPanel(
            'mssqlTestViewer',
            `Test: ${schema}.${name}`,
            column || vscode.ViewColumn.Active,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        
        const instance = new TestViewerPanel(panel, connectionPool, databaseName, schema, name, kind);
        TestViewerPanel.panels.set(key, instance);
        return instance;
    }

    constructor(panel, connectionPool, databaseName, schema, name, kind) {
        this.panel = panel;
        this.connectionPool = connectionPool;
        this.databaseName = databaseName;
        this.schema = schema;
        this.name = name;
        this.kind = kind;

        this.panel.onDidDispose(() => {
            TestViewerPanel.panels.delete(`test-${this.databaseName}.${this.schema}.${this.name}`);
        });

        this.setupMessageHandling();
        this.showTestView();
    }

    setupMessageHandling() {
        this.panel.webview.onDidReceiveMessage(async (message) => {
            console.log('Test viewer received message:', message);
            switch (message.command) {
                case 'testButton':
                    vscode.window.showInformationMessage('Test button clicked from webview!');
                    break;
                case 'testData':
                    vscode.window.showInformationMessage(`Test data: ${message.data}`);
                    break;
            }
        });
    }

    showTestView() {
        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test View</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            margin: 20px;
            padding: 20px;
        }
        .test-container {
            max-width: 800px;
            margin: 0 auto;
        }
        .test-section {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            background: var(--vscode-panel-background);
        }
        .test-button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 3px;
            cursor: pointer;
            margin: 5px;
            font-size: 14px;
        }
        .test-button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .test-input {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 8px;
            border-radius: 3px;
            margin: 5px;
            width: 200px;
        }
        .status {
            margin: 10px 0;
            padding: 10px;
            background: var(--vscode-textBlockQuote-background);
            border-radius: 3px;
        }
        .success {
            color: var(--vscode-terminal-ansiGreen);
        }
        .error {
            color: var(--vscode-errorForeground);
        }
    </style>
</head>
<body>
    <div class="test-container">
        <h1>🧪 JavaScript Test View</h1>
        <p>This is a test view to verify that JavaScript is working in the webview.</p>
        
        <div class="test-section">
            <h3>Basic JavaScript Test</h3>
            <button class="test-button" onclick="testBasicJS()">Test Basic JavaScript</button>
            <button class="test-button" onclick="testAlert()">Test Alert</button>
            <div id="basicTestResult" class="status"></div>
        </div>

        <div class="test-section">
            <h3>VSCode API Test</h3>
            <button class="test-button" onclick="testVSCodeAPI()">Test VSCode API</button>
            <div id="vscodeTestResult" class="status"></div>
        </div>

        <div class="test-section">
            <h3>Message Test</h3>
            <input type="text" id="testInput" class="test-input" placeholder="Enter test message" value="Hello from webview!">
            <button class="test-button" onclick="testMessage()">Send Message to Extension</button>
            <div id="messageTestResult" class="status"></div>
        </div>

        <div class="test-section">
            <h3>Table Information</h3>
            <p><strong>Database:</strong> ${this.databaseName}</p>
            <p><strong>Schema:</strong> ${this.schema}</p>
            <p><strong>Table:</strong> ${this.name}</p>
            <p><strong>Type:</strong> ${this.kind}</p>
        </div>

        <div class="test-section">
            <h3>Console Logs</h3>
            <p>Check the browser console (F12) for detailed logs.</p>
            <button class="test-button" onclick="logTest()">Log Test Message</button>
        </div>
    </div>

    <script>
        console.log('=== TEST VIEWER SCRIPT LOADED ===');
        
        // Store VSCode API instance once
        let vscode = null;
        try {
            vscode = acquireVsCodeApi();
            console.log('VSCode API acquired successfully');
        } catch (error) {
            console.error('Failed to acquire VSCode API:', error);
        }
        
        // Test basic JavaScript
        function testBasicJS() {
            console.log('Basic JS test clicked');
            const result = document.getElementById('basicTestResult');
            result.innerHTML = '<span class="success">✅ Basic JavaScript is working!</span>';
            result.style.display = 'block';
        }

        // Test alert
        function testAlert() {
            console.log('Alert test clicked');
            try {
                alert('JavaScript alert is working!');
            } catch (error) {
                console.error('Alert error:', error);
                const result = document.getElementById('basicTestResult');
                result.innerHTML = '<span class="error">❌ Alert error: ' + error.message + '</span>';
                result.style.display = 'block';
            }
        }

        // Test VSCode API
        function testVSCodeAPI() {
            console.log('VSCode API test clicked');
            const result = document.getElementById('vscodeTestResult');
            
            if (vscode) {
                console.log('VSCode API is available:', vscode);
                result.innerHTML = '<span class="success">✅ VSCode API is working!</span>';
                result.style.display = 'block';
            } else {
                result.innerHTML = '<span class="error">❌ VSCode API not available</span>';
                result.style.display = 'block';
            }
        }

        // Test message sending
        function testMessage() {
            console.log('Message test clicked');
            const input = document.getElementById('testInput');
            const message = input.value || 'Hello from webview!';
            
            if (vscode) {
                try {
                    vscode.postMessage({
                        command: 'testData',
                        data: message
                    });
                    
                    const result = document.getElementById('messageTestResult');
                    result.innerHTML = '<span class="success">✅ Message sent: "' + message + '"</span>';
                    result.style.display = 'block';
                } catch (error) {
                    console.error('Message error:', error);
                    const result = document.getElementById('messageTestResult');
                    result.innerHTML = '<span class="error">❌ Message error: ' + error.message + '</span>';
                    result.style.display = 'block';
                }
            } else {
                const result = document.getElementById('messageTestResult');
                result.innerHTML = '<span class="error">❌ VSCode API not available for messaging</span>';
                result.style.display = 'block';
            }
        }

        // Test console logging
        function logTest() {
            console.log('=== CONSOLE LOG TEST ===');
            console.log('This is a test log message');
            console.warn('This is a test warning');
            console.error('This is a test error');
            console.log('Current time:', new Date().toISOString());
        }

        // Auto-run basic tests on load
        window.addEventListener('load', function() {
            console.log('Test viewer page loaded');
            logTest();
        });

        // Test if functions are accessible
        console.log('Available functions:', {
            testBasicJS: typeof testBasicJS,
            testAlert: typeof testAlert,
            testVSCodeAPI: typeof testVSCodeAPI,
            testMessage: typeof testMessage,
            logTest: typeof logTest
        });
    </script>
</body>
</html>`;

        this.panel.webview.html = html;
    }
}

module.exports = { TestViewerPanel };
