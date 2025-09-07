const vscode = require('vscode');
const sql = require('mssql/msnodesqlv8');

class ConnectionManager {
	constructor(context, globalState) {
		this.context = context;
		this.globalState = globalState;
		this.pools = new Map(); // id -> sql.ConnectionPool
	}

	isConnected(id) {
		const pool = this.pools.get(id);
		return !!(pool && pool.connected);
	}

	async ensureConnected(id, password) {
		if (this.isConnected(id)) return true;
		const conn = await this.globalState.getConnectionById(id);
		if (!conn) return false;
		const cfg = this._buildConfig(conn, password);
		const pool = new sql.ConnectionPool(cfg);
		await pool.connect();
		this.pools.set(id, pool);
		return true;
	}

	disconnect(id) {
		const pool = this.pools.get(id);
		if (pool) {
			pool.close().catch(() => {});
			this.pools.delete(id);
		}
	}

	getPool(id) { return this.pools.get(id); }

	_buildConfig(conn, password) {
		return {
			server: conn.server,
			database: conn.database,
			driver: 'msnodesqlv8',
			options: {
				trustedConnection: conn.options?.trustedConnection || false,
				trustServerCertificate: conn.options?.trustServerCertificate !== false
			},
			user: conn.user,
			password: password || conn.password || ''
		};
	}

	_buildConfigFromData(data) {
		return {
			server: data.server,
			database: data.database,
			driver: 'msnodesqlv8',
			options: {
				trustedConnection: !!data.options?.trustedConnection,
				trustServerCertificate: data.options?.trustServerCertificate !== false
			},
			user: data.user,
			password: data.password || ''
		};
	}

	async testConnectionData(data) {
		try {
			const cfg = this._buildConfigFromData(data);
			const pool = new sql.ConnectionPool(cfg);
			await pool.connect();
			await pool.close();
			return true;
		} catch (err) {
			const code = err && (err.code || err.number || err.sqlstate);
			const inner = err && err.originalError && (err.originalError.message || err.originalError.info || err.originalError);
			const baseMsg = (typeof err?.message === 'string' && err.message) || (typeof inner === 'string' && inner) || String(inner || err);
			const msg = code ? `[${code}] ${baseMsg}` : baseMsg;
			throw new Error(msg);
		}
	}
}

module.exports = { ConnectionManager };


