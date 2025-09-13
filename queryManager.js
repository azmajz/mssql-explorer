const vscode = require('vscode');
const path = require('path');

class QueryManager {
    constructor(context) {
        this.context = context;
        this.storageKey = 'mssql-explorer.savedQueries';
        this.queries = this.loadQueries();
    }

    loadQueries() {
        const saved = this.context.globalState.get(this.storageKey, []);
        return saved || [];
    }

    saveQueries() {
        this.context.globalState.update(this.storageKey, this.queries);
    }

    addQuery(name, query, description = '') {
        const id = Date.now().toString();
        const queryObj = {
            id,
            name,
            query,
            description,
            createdAt: new Date().toISOString(),
            lastUsed: null
        };
        
        this.queries.push(queryObj);
        this.saveQueries();
        return queryObj;
    }

    updateQuery(id, updates) {
        const index = this.queries.findIndex(q => q.id === id);
        if (index !== -1) {
            this.queries[index] = { ...this.queries[index], ...updates };
            this.saveQueries();
            return this.queries[index];
        }
        return null;
    }

    deleteQuery(id) {
        const index = this.queries.findIndex(q => q.id === id);
        if (index !== -1) {
            const deleted = this.queries.splice(index, 1)[0];
            this.saveQueries();
            return deleted;
        }
        return null;
    }

    getQuery(id) {
        return this.queries.find(q => q.id === id);
    }

    getAllQueries() {
        return [...this.queries];
    }

    markAsUsed(id) {
        const query = this.getQuery(id);
        if (query) {
            query.lastUsed = new Date().toISOString();
            this.saveQueries();
        }
    }

    async executeQuery(queryId, connectionManager) {
        const query = this.getQuery(queryId);
        if (!query) {
            throw new Error('Query not found');
        }

        if (!connectionManager.active) {
            throw new Error('No active connection');
        }

        this.markAsUsed(queryId);
        
        const pool = connectionManager.active.pool;
        const result = await pool.request().query(query.query);
        
        return {
            query: query,
            result: result
        };
    }
}

module.exports = { QueryManager };
