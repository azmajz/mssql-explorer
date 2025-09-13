const vscode = require('vscode');
const { ConnectionViewPanel } = require('../connectionView');

class ConnectionCommands {
    constructor(connectionManager, treeProvider, context) {
        this.connectionManager = connectionManager;
        this.treeProvider = treeProvider;
        this.context = context;
    }

    async pickConnection() {
        const list = this.connectionManager.listConnections();
        if (!list.length) { 
            vscode.window.showInformationMessage('No connections'); 
            return undefined; 
        }
        
        const labelToId = new Map();
        const options = list.map(c => {
            const label = `${c.name} (${c.config.server})`;
            labelToId.set(label, c.id);
            return label;
        });
        
        const picked = await vscode.window.showQuickPick(options);
        return picked ? labelToId.get(picked) : undefined;
    }

    async addConnection() {
        try {
            ConnectionViewPanel.createOrShow(this.context, this.connectionManager, this.treeProvider);
        } catch (error) {
            const errorMessage = error.message || error.toString() || 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to open connection view: ${errorMessage}`);
            console.error('Connection view error:', error);
        }
    }

    async editConnection(item) {
        try {
            const id = item?.connectionId || (await this.pickConnection());
            if (!id) return;

            const conn = this.connectionManager.listConnections().find(c => c.id === id);
            if (!conn) {
                vscode.window.showErrorMessage('Connection not found');
                return;
            }

            const name = await vscode.window.showInputBox({ 
                prompt: 'Connection name', 
                value: conn.name 
            });
            if (!name) return;

            await this.connectionManager.updateConnection(id, { name });
            this.treeProvider.refresh();
            vscode.window.showInformationMessage('Connection updated successfully');
        } catch (error) {
            const errorMessage = error.message || error.toString() || 'Unknown error occurred';
            vscode.window.showErrorMessage(`Update failed: ${errorMessage}`);
            console.error('Update error:', error);
        }
    }

    async deleteConnection(item) {
        try {
            const id = item?.connectionId || (await this.pickConnection());
            if (!id) return;

            const conn = this.connectionManager.listConnections().find(c => c.id === id);
            if (!conn) {
                vscode.window.showErrorMessage('Connection not found');
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                `Delete connection "${conn.name}"?`, 
                { modal: true }, 
                'Delete'
            );
            
            if (confirm === 'Delete') {
                await this.connectionManager.deleteConnection(id);
                this.treeProvider.refresh();
                vscode.window.showInformationMessage('Connection deleted successfully');
            }
        } catch (error) {
            const errorMessage = error.message || error.toString() || 'Unknown error occurred';
            vscode.window.showErrorMessage(`Delete failed: ${errorMessage}`);
            console.error('Delete error:', error);
        }
    }

    async connect(item) {
        try {
            const id = item?.connectionId || (await this.pickConnection());
            if (!id) return;

            const conn = this.connectionManager.listConnections().find(c => c.id === id);
            if (!conn) {
                vscode.window.showErrorMessage('Connection not found');
                return;
            }

            await this.connectionManager.connect(conn);
            this.treeProvider.refresh();
            vscode.window.showInformationMessage(`Connected: ${conn.name}`);
        } catch (error) {
            const errorMessage = error.message || error.toString() || 'Unknown error occurred';
            vscode.window.showErrorMessage(`Connect failed: ${errorMessage}`);
            console.error('Connect error:', error);
        }
    }

    async disconnect() {
        try {
            await this.connectionManager.disconnect();
            this.treeProvider.refresh();
            vscode.window.showInformationMessage('Disconnected');
        } catch (error) {
            const errorMessage = error.message || error.toString() || 'Unknown error occurred';
            vscode.window.showErrorMessage(`Disconnect failed: ${errorMessage}`);
            console.error('Disconnect error:', error);
        }
    }
}

module.exports = { ConnectionCommands };
