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

    extractErrorMessage(error) {
        if (typeof error === 'string') {
            return error;
        }
        
        if (error && typeof error === 'object') {
            if (error.message && typeof error.message === 'string' && error.message !== '[object Object]') {
                return error.message;
            }
            
            if (error.originalError) {
                return this.extractErrorMessage(error.originalError);
            }
            
            if (error.details) {
                return error.details;
            }
            
            if (error.info && typeof error.info === 'string') {
                return error.info;
            }
            
            if (error.toString && error.toString() !== '[object Object]') {
                return error.toString();
            }
        }
        
        return 'Unknown error occurred';
    }

    async test(config) {
        try {
            // Use the same approach as connect method - let mssql handle its own timeouts
            const pool = await sql.connect(config);
            await pool.close();
        } catch (error) {
            console.log('Raw error:', error);
            console.log('Error type:', error.constructor.name);
            console.log('Error properties:', Object.keys(error));
            
            // Extract meaningful error message from mssql ConnectionError
            let errorMessage = 'Connection failed. ';
            
            // Handle mssql ConnectionError specifically
            if (error.name === 'ConnectionError' || error.constructor.name === 'ConnectionError') {
                // Try to extract the actual error from nested properties
                if (error.originalError) {
                    errorMessage = this.extractErrorMessage(error.originalError);
                } else if (error.details) {
                    errorMessage = error.details;
                } else if (error.info) {
                    errorMessage = error.info.message || error.info;
                } else if (error.number) {
                    // SQL Server error numbers
                    const sqlErrors = {
                        2: 'Server not found. Please check the server name or IP address.',
                        53: 'Network path not found. Please check the server name and network connectivity.',
                        18456: 'Login failed. Please check your username and password.',
                        18470: 'Login failed. Please check your username and password.',
                        18487: 'Login failed. Please check your username and password.',
                        18488: 'Login failed. Please check your username and password.'
                    };
                    errorMessage = sqlErrors[error.number] || `SQL Server error ${error.number}: ${error.message || 'Connection failed'}`;
                } else {
                    errorMessage = 'Connection failed. Please check your server name, credentials, and network connectivity.';
                }
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Connection refused. Please check if the server is running and the server name is correct.';
            } else if (error.code === 'ETIMEOUT' || (error.message && error.message.includes('timeout'))) {
                errorMessage = 'Connection timeout. Please check if the server is accessible and the port is correct.';
            } else if (error.code === 'ELOGIN' || (error.message && error.message.includes('Login failed'))) {
                errorMessage = 'Login failed. Please check your username and password.';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = 'Server not found. Please check the server name or IP address.';
            } else if (error.message && typeof error.message === 'string' && error.message !== '[object Object]') {
                errorMessage = error.message;
            } else if (error.toString && error.toString() !== '[object Object]') {
                errorMessage = error.toString();
            } else {
                errorMessage = 'Connection failed. Please check your connection settings and try again.';
            }
            
            throw new Error(errorMessage);
        }
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
        
        try {
            const pool = await sql.connect(normalized);
            this.active = { id: connection.id, name: connection.name, config: connection.config, pool };
            return this.active;
        } catch (error) {
            // Provide more specific error messages for connection
            let errorMessage = error.message || error.toString();
            
            if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Connection refused. Please check if the server is running and the server name is correct.';
            } else if (error.code === 'ETIMEOUT') {
                errorMessage = 'Connection timeout. Please check if the server is accessible and the port is correct.';
            } else if (error.code === 'ELOGIN') {
                errorMessage = 'Login failed. Please check your username and password.';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = 'Server not found. Please check the server name or IP address.';
            } else if (error.message && error.message.includes('Login failed')) {
                errorMessage = 'Login failed. Please verify your username and password are correct.';
            } else if (error.message && error.message.includes('Cannot connect')) {
                errorMessage = 'Cannot connect to server. Please check the server name, port, and network connectivity.';
            } else if (error.message && error.message.includes('timeout')) {
                errorMessage = 'Connection timeout. The server may be busy or unreachable.';
            }
            
            throw new Error(errorMessage);
        }
    }

    async disconnect() {
        if (this.active && this.active.pool) {
            try { await this.active.pool.close(); } catch {}
        }
        this.active = null;
    }
}

module.exports = { ConnectionManager };


