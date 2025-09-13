const vscode = require('vscode');

class ObjectCommands {
    constructor(connectionManager, gridViewerPanel) {
        this.connectionManager = connectionManager;
        this.gridViewerPanel = gridViewerPanel;
    }

    async previewData(item) {
        if (!this.connectionManager.active) {
            return vscode.window.showErrorMessage('Not connected');
        }
        
        if (!item || !item.databaseName || !item.label) {
            return vscode.window.showErrorMessage('Invalid item for data preview');
        }
        
        const [schema, name] = String(item.label).split('.');
        this.gridViewerPanel.createOrShow(
            this.connectionManager.active.pool, 
            item.databaseName, 
            schema, 
            name, 
            'table'
        );
    }

    async copyTableName(item) {
        if (!item || !item.label) {
            return vscode.window.showErrorMessage('No table name to copy');
        }
        
        await vscode.env.clipboard.writeText(String(item.label));
        vscode.window.showInformationMessage('Table name copied');
    }

    async openObject(args) {
        const { databaseName, schema, name, kind } = args;
        
        if (!this.connectionManager.active) {
            return vscode.window.showErrorMessage('Not connected');
        }
        
        if (kind === 'table' || kind === 'view') {
            this.gridViewerPanel.createOrShow(
                this.connectionManager.active.pool, 
                databaseName, 
                schema, 
                name, 
                kind
            );
            return;
        }
        
        // Show definition for routines/functions
        try {
            const req = this.connectionManager.active.pool.request();
            const query = `USE [${databaseName}]; SELECT OBJECT_DEFINITION(OBJECT_ID('[${schema}].[${name}]')) AS Definition`;
            const res = await req.query(query);
            const doc = await vscode.workspace.openTextDocument({ 
                language: 'sql', 
                content: res.recordset?.[0]?.Definition || '-- No definition' 
            });
            await vscode.window.showTextDocument(doc, { preview: true });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open object: ${error.message}`);
        }
    }
}

module.exports = { ObjectCommands };
