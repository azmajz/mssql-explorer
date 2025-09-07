const vscode = require('vscode');

class DataViewerPanel {
    static currentPanel = undefined;

    static createOrShow(context, database, schema, objectName, objectType, connectionPool) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (DataViewerPanel.currentPanel) {
            DataViewerPanel.currentPanel.panel.reveal(column);
            DataViewerPanel.currentPanel.updateContent(database, schema, objectName, objectType);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'dataViewer',
            `${database}.${schema}.${objectName}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        DataViewerPanel.currentPanel = new DataViewerPanel(panel, context, database, schema, objectName, objectType, connectionPool);
    }

    constructor(panel, context, database, schema, objectName, objectType, connectionPool) {
        this.panel = panel;
        this.context = context;
        this.database = database;
        this.schema = schema;
        this.objectName = objectName;
        this.objectType = objectType;
        this.connectionPool = connectionPool;

        this.updateContent(database, schema, objectName, objectType);

        this.panel.onDidDispose(() => {
            DataViewerPanel.currentPanel = undefined;
        });
    }

    async updateContent(database, schema, objectName, objectType) {
        this.database = database;
        this.schema = schema;
        this.objectName = objectName;
        this.objectType = objectType;

        this.panel.title = `${database}.${schema}.${objectName}`;
        this.panel.webview.html = await this.getWebviewContent();
    }

    async getWebviewContent() {
        let content = '';
        let query = '';

        try {
            if (this.objectType === 'table') {
                query = `USE [${this.database}]; SELECT TOP 1000 * FROM [${this.schema}].[${this.objectName}]`;
                const result = await this.executeQuery(query);
                content = this.formatTableData(result);
            } else if (this.objectType === 'view') {
                query = `USE [${this.database}]; SELECT TOP 1000 * FROM [${this.schema}].[${this.objectName}]`;
                const result = await this.executeQuery(query);
                content = this.formatTableData(result);
            } else if (this.objectType === 'storedProcedure') {
                query = `USE [${this.database}]; SELECT OBJECT_DEFINITION(OBJECT_ID('[${this.schema}].[${this.objectName}]')) AS Definition`;
                const result = await this.executeQuery(query);
                content = this.formatCodeData(result.recordset[0].Definition);
            } else if (this.objectType === 'function') {
                query = `USE [${this.database}]; SELECT OBJECT_DEFINITION(OBJECT_ID('[${this.schema}].[${this.objectName}]')) AS Definition`;
                const result = await this.executeQuery(query);
                content = this.formatCodeData(result.recordset[0].Definition);
            }
        } catch (error) {
            content = `<div class="error">Error: ${error.message}</div>`;
        }

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Data Viewer</title>
            <style>
                body { 
                    font-family: var(--vscode-font-family); 
                    font-size: var(--vscode-font-size); 
                    color: var(--vscode-foreground); 
                    background: var(--vscode-editor-background); 
                    margin: 0; 
                    padding: 20px; 
                }
                .error { 
                    color: var(--vscode-errorForeground); 
                    background: var(--vscode-inputValidation-errorBackground); 
                    padding: 10px; 
                    border-radius: 4px; 
                    margin: 10px 0; 
                }
                table { 
                    border-collapse: collapse; 
                    width: 100%; 
                    margin: 10px 0; 
                }
                th, td { 
                    border: 1px solid var(--vscode-panel-border); 
                    padding: 8px; 
                    text-align: left; 
                }
                th { 
                    background: var(--vscode-panel-background); 
                    font-weight: bold; 
                }
                tr:nth-child(even) { 
                    background: var(--vscode-list-hoverBackground); 
                }
                pre { 
                    background: var(--vscode-textCodeBlock-background); 
                    padding: 10px; 
                    border-radius: 4px; 
                    overflow-x: auto; 
                }
                .query-info { 
                    background: var(--vscode-textBlockQuote-background); 
                    padding: 10px; 
                    border-radius: 4px; 
                    margin: 10px 0; 
                    font-family: monospace; 
                }
            </style>
        </head>
        <body>
            <div class="query-info">Query: ${query}</div>
            ${content}
        </body>
        </html>`;
    }

    async executeQuery(query) {
        if (!this.connectionPool) {
            throw new Error('Not connected to database');
        }
        const request = this.connectionPool.request();
        return await request.query(query);
    }

    formatTableData(result) {
        if (!result.recordset || result.recordset.length === 0) {
            return '<div>No data found</div>';
        }

        const columns = Object.keys(result.recordset[0]);
        let html = '<table><thead><tr>';
        columns.forEach(col => {
            html += `<th>${col}</th>`;
        });
        html += '</tr></thead><tbody>';

        result.recordset.forEach(row => {
            html += '<tr>';
            columns.forEach(col => {
                html += `<td>${row[col] || ''}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    formatCodeData(code) {
        return `<pre><code>${code || 'No definition found'}</code></pre>`;
    }
}

module.exports = { DataViewerPanel };
