const vscode = require('vscode');

class QueryExecutor {
    static async executeCustomQuery(connectionPool) {
        if (!connectionPool) {
            vscode.window.showErrorMessage('Please connect to a database first');
            return;
        }

        const query = await vscode.window.showInputBox({
            prompt: 'Enter SQL query',
            placeHolder: 'SELECT * FROM table_name'
        });

        if (!query) return;

        try {
            const request = connectionPool.request();
            const result = await request.query(query);
            
            // Create a new webview panel to show results
            const panel = vscode.window.createWebviewPanel(
                'queryResults',
                'Query Results',
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            let content = '';
            if (result.recordset && result.recordset.length > 0) {
                const columns = Object.keys(result.recordset[0]);
                content = '<table><thead><tr>';
                columns.forEach(col => {
                    content += `<th>${col}</th>`;
                });
                content += '</tr></thead><tbody>';

                result.recordset.forEach(row => {
                    content += '<tr>';
                    columns.forEach(col => {
                        content += `<td>${row[col] || ''}</td>`;
                    });
                    content += '</tr>';
                });

                content += '</tbody></table>';
            } else {
                content = '<div>Query executed successfully. No results returned.</div>';
            }

            panel.webview.html = `<!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: var(--vscode-font-family); padding: 20px; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid var(--vscode-panel-border); padding: 8px; }
                    th { background: var(--vscode-panel-background); }
                </style>
            </head>
            <body>
                <h3>Query: ${query}</h3>
                ${content}
            </body>
            </html>`;

        } catch (error) {
            vscode.window.showErrorMessage(`Query failed: ${error.message}`);
        }
    }
}

module.exports = { QueryExecutor };
