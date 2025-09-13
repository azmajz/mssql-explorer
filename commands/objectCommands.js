const vscode = require('vscode');
const { AdvancedGridViewerPanel } = require('../advancedGridViewer');
const { TestViewerPanel } = require('../testViewer');

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

    async selectDataWithOptions(item) {
        if (!this.connectionManager.active) {
            return vscode.window.showErrorMessage('Not connected');
        }
        
        // Handle tree item clicks - items now have databaseName, schema, name properties
        if (!item || !item.databaseName || !item.schema || !item.name) {
            return vscode.window.showErrorMessage('Invalid item for data selection');
        }
        
        const { databaseName, schema, name } = item;
        const kind = item.contextValue || 'table';
        
        AdvancedGridViewerPanel.createOrShow(
            this.connectionManager.active.pool, 
            databaseName, 
            schema, 
            name, 
            kind,
            {
                selectedColumns: [], // Will be populated by the advanced viewer
                orderBy: '',
                currentPage: 1,
                pageSize: 100
            }
        );
    }

    async openTestView(item) {
        if (!this.connectionManager.active) {
            return vscode.window.showErrorMessage('Not connected');
        }
        
        // Handle tree item clicks - items now have databaseName, schema, name properties
        if (!item || !item.databaseName || !item.schema || !item.name) {
            return vscode.window.showErrorMessage('Invalid item for test view');
        }
        
        const { databaseName, schema, name } = item;
        const kind = item.contextValue || 'table';
        
        TestViewerPanel.createOrShow(
            this.connectionManager.active.pool, 
            databaseName, 
            schema, 
            name, 
            kind
        );
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
