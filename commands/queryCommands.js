const vscode = require('vscode');
const { EXTENSION_CONFIG } = require('../constants');

class QueryCommands {
    constructor(queryManager, treeProvider, connectionManager) {
        this.queryManager = queryManager;
        this.treeProvider = treeProvider;
        this.connectionManager = connectionManager;
    }

    async addQuery() {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter query name',
            placeHolder: 'My Query',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Query name is required';
                }
                return null;
            }
        });

        if (!name) return;

        const description = await vscode.window.showInputBox({
            prompt: 'Enter query description (optional)',
            placeHolder: 'Description of what this query does'
        });

        const query = await vscode.window.showInputBox({
            prompt: 'Enter SQL query',
            placeHolder: 'SELECT * FROM table_name',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Query is required';
                }
                return null;
            }
        });

        if (!query) return;

        try {
            this.queryManager.addQuery(name, query, description || '');
            this.treeProvider.refresh();
            vscode.window.showInformationMessage(`Query "${name}" saved successfully`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save query: ${error.message}`);
        }
    }

    async editQuery(item) {
        const queryId = item.queryId || (item.id ? item.id.split('|')[1] : null);
        const query = this.queryManager.getQuery(queryId);
        
        if (!query) {
            vscode.window.showErrorMessage('Query not found');
            return;
        }

        const name = await vscode.window.showInputBox({
            prompt: 'Enter query name',
            value: query.name,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Query name is required';
                }
                return null;
            }
        });

        if (name === undefined) return; // User cancelled

        const description = await vscode.window.showInputBox({
            prompt: 'Enter query description (optional)',
            value: query.description || '',
            placeHolder: 'Description of what this query does'
        });

        if (description === undefined) return; // User cancelled

        const queryText = await vscode.window.showInputBox({
            prompt: 'Enter SQL query',
            value: query.query,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Query is required';
                }
                return null;
            }
        });

        if (queryText === undefined) return; // User cancelled

        try {
            this.queryManager.updateQuery(queryId, {
                name,
                description: description || '',
                query: queryText
            });
            this.treeProvider.refresh();
            vscode.window.showInformationMessage(`Query "${name}" updated successfully`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update query: ${error.message}`);
        }
    }

    async deleteQuery(item) {
        const queryId = item.queryId || (item.id ? item.id.split('|')[1] : null);
        const query = this.queryManager.getQuery(queryId);
        
        if (!query) {
            vscode.window.showErrorMessage('Query not found');
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete query "${query.name}"?`,
            { modal: true },
            'Delete'
        );

        if (confirm === 'Delete') {
            try {
                this.queryManager.deleteQuery(queryId);
                this.treeProvider.refresh();
                vscode.window.showInformationMessage(`Query "${query.name}" deleted successfully`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to delete query: ${error.message}`);
            }
        }
    }

    async executeQuery(item) {
        const queryId = item.queryId || (item.id ? item.id.split('|')[1] : null);
        
        if (!this.connectionManager.active) {
            vscode.window.showErrorMessage('No active connection. Please connect to a database first.');
            return;
        }

        try {
            const result = await this.queryManager.executeQuery(queryId, this.connectionManager);
            
            // Open the result in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: this.formatQueryResult(result),
                language: 'sql'
            });
            
            await vscode.window.showTextDocument(doc);
            
            vscode.window.showInformationMessage(`Query "${result.query.name}" executed successfully`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to execute query: ${error.message}`);
        }
    }

    formatQueryResult(result) {
        const { query, result: queryResult } = result;
        let content = `-- Query: ${query.name}\n`;
        content += `-- Description: ${query.description || 'No description'}\n`;
        content += `-- Executed: ${new Date().toLocaleString()}\n\n`;
        content += `-- Original Query:\n${query.query}\n\n`;
        
        if (queryResult.recordset && queryResult.recordset.length > 0) {
            content += `-- Results (${queryResult.recordset.length} rows):\n`;
            
            // Get column names
            const columns = Object.keys(queryResult.recordset[0]);
            content += `-- Columns: ${columns.join(', ')}\n\n`;
            
            // Show first few rows as example
            const maxRows = 10;
            const rowsToShow = queryResult.recordset.slice(0, maxRows);
            
            rowsToShow.forEach((row, index) => {
                content += `-- Row ${index + 1}:\n`;
                columns.forEach(col => {
                    content += `--   ${col}: ${row[col]}\n`;
                });
                content += '\n';
            });
            
            if (queryResult.recordset.length > maxRows) {
                content += `-- ... and ${queryResult.recordset.length - maxRows} more rows\n`;
            }
        } else {
            content += `-- No results returned\n`;
        }
        
        return content;
    }
}

module.exports = { QueryCommands };
