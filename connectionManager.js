const sql = require('mssql/msnodesqlv8');

class ConnectionManager {
    constructor(context) {
        this.context = context;
        this.connections = this.context.globalState.get('mssqlExplorer.connections', []);
        this.active = null; // { id, name, config, pool }
    }

    listConnections() {
        return this.connections;
    }

    async addConnection(connection) {
        // connection: { id, name, config }
        this.connections.push({ id: connection.id, name: connection.name, config: connection.config });
        await this.context.globalState.update('mssqlExplorer.connections', this.connections);
        return connection;
    }

    async updateConnection(id, updates) {
        const idx = this.connections.findIndex(c => c.id === id);
        if (idx === -1) { throw new Error('Connection not found'); }
        this.connections[idx] = { ...this.connections[idx], ...updates };
        await this.context.globalState.update('mssqlExplorer.connections', this.connections);
        return this.connections[idx];
    }

    async deleteConnection(id) {
        const idx = this.connections.findIndex(c => c.id === id);
        if (idx === -1) { return; }
        const toDelete = this.connections[idx];
        this.connections.splice(idx, 1);
        await this.context.globalState.update('mssqlExplorer.connections', this.connections);
        if (this.active && this.active.id === id) {
            await this.disconnect();
        }
        return toDelete;
    }

    async test(config) {
        const pool = await sql.connect(config);
        await pool.close();
    }

    async connect(connection) {
        if (!connection || !connection.config) {
            throw new Error('Invalid connection configuration');
        }
        await this.disconnect();
        const base = connection.config || {};
        const normalized = {
            server: base.server,
            database: base.database || undefined,
            driver: 'msnodesqlv8',
            options: {
                trustedConnection: base.options?.trustedConnection ?? false,
                trustServerCertificate: base.options?.trustServerCertificate ?? true
            },
            user: base.user,
            password: base.password
        };
        const pool = await sql.connect(normalized);
        this.active = { id: connection.id, name: connection.name, config: connection.config, pool };
        return this.active;
    }

    async disconnect() {
        if (this.active && this.active.pool) {
            try { await this.active.pool.close(); } catch {}
        }
        this.active = null;
    }
}

module.exports = { ConnectionManager };


