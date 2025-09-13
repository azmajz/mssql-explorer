const vscode = require('vscode');

class FilterCommands {
    constructor(treeProvider) {
        this.treeProvider = treeProvider;
    }

    async filterGroup(item) {
        if (!item || !item.id) return;
        
        const [group, dbName] = String(item.id).split('|');
        const value = await vscode.window.showInputBox({ 
            prompt: `Filter ${group} in ${dbName}`, 
            placeHolder: 'Enter search text' 
        });
        
        this.treeProvider.setGroupFilter(group, dbName, value || '');
    }

    async clearGroupFilter(item) {
        if (!item || !item.id) return;
        
        const [group, dbName] = String(item.id).split('|');
        this.treeProvider.setGroupFilter(group, dbName, '');
    }

    async filterDatabase(item) {
        if (!item || !item.id || !String(item.id).startsWith('db|')) return;
        
        const dbName = String(item.id).split('|')[1];
        const value = await vscode.window.showInputBox({ 
            prompt: `Filter all objects in ${dbName}`, 
            placeHolder: 'Enter search text' 
        });
        
        this.treeProvider.setDatabaseFilter(dbName, value || '');
    }

    async clearDatabaseFilter(item) {
        if (!item || !item.id || !String(item.id).startsWith('db|')) return;
        
        const dbName = String(item.id).split('|')[1];
        this.treeProvider.setDatabaseFilter(dbName, '');
    }

    async openFilterResults(item) {
        if (!item || !item.id) return;
        
        const [kind, dbName] = String(item.id).split('|');
        const content = await this.treeProvider.buildFilterResults(kind, dbName);
        const doc = await vscode.workspace.openTextDocument({ 
            language: 'markdown', 
            content 
        });
        await vscode.window.showTextDocument(doc, { preview: false });
    }
}

module.exports = { FilterCommands };
