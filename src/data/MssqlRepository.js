class MssqlRepository {
	constructor(connectionManager) {
		this.connectionManager = connectionManager;
	}

	_getPool(connectionId) {
		const pool = this.connectionManager.getPool(connectionId);
		if (!pool) { throw new Error('Not connected'); }
		return pool;
	}

	async listDatabases(connectionId) {
		const pool = this._getPool(connectionId);
		const result = await pool.request().query(`
			SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name
		`);
		return result.recordset.map(r => r.name);
	}

	async listSchemas(connectionId, database) {
		const pool = this._getPool(connectionId);
		const result = await pool.request().query(`
			USE [${database}];
			SELECT name FROM sys.schemas ORDER BY name
		`);
		return result.recordset.map(r => r.name);
	}

	async listObjects(connectionId, database, schema) {
		const pool = this._getPool(connectionId);
		const request = pool.request();
		const tables = await request.query(`
			USE [${database}];
			SELECT t.name AS name, 'TABLE' AS type FROM sys.tables t
			INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
			WHERE s.name = '${schema}' ORDER BY t.name;
		`);
		const views = await request.query(`
			USE [${database}];
			SELECT v.name AS name, 'VIEW' AS type FROM sys.views v
			INNER JOIN sys.schemas s ON v.schema_id = s.schema_id
			WHERE s.name = '${schema}' ORDER BY v.name;
		`);
		const procs = await request.query(`
			USE [${database}];
			SELECT p.name AS name, 'PROC' AS type FROM sys.procedures p
			INNER JOIN sys.schemas s ON p.schema_id = s.schema_id
			WHERE s.name = '${schema}' ORDER BY p.name;
		`);
		const funcs = await request.query(`
			USE [${database}];
			SELECT o.name AS name, 'FUNC' AS type
			FROM sys.objects o INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
			WHERE s.name='${schema}' AND o.type IN ('FN','IF','TF') ORDER BY o.name;
		`);
		const triggers = await request.query(`
			USE [${database}];
			SELECT tr.name AS name, 'TRIGGER' AS type
			FROM sys.triggers tr INNER JOIN sys.tables t ON tr.parent_id = t.object_id
			INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
			WHERE s.name='${schema}' ORDER BY tr.name;
		`);
		return {
			tables: tables.recordset,
			views: views.recordset,
			procedures: procs.recordset,
			functions: funcs.recordset,
			triggers: triggers.recordset
		};
	}

	async runQuery(connectionId, database, sqlText, offset = 0, limit = 100) {
		const pool = this._getPool(connectionId);
		const request = pool.request();
		// If the query looks like a simple SELECT without OFFSET, apply pagination fallback
		let text = sqlText.trim();
		const upper = text.toUpperCase();
		if (upper.startsWith('SELECT') && !upper.includes('OFFSET') && !upper.includes('FETCH NEXT')) {
			text = `${text}\nORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
		}
		const start = Date.now();
		const result = await request.query(`USE [${database}]; ${text}`);
		const durationMs = Date.now() - start;
		return {
			recordset: result.recordset || [],
			columns: result.recordset && result.recordset.length > 0 ? Object.keys(result.recordset[0]) : [],
			rowCount: Array.isArray(result.recordset) ? result.recordset.length : 0,
			durationMs
		};
	}

	async getTableDDL(connectionId, database, schema, table) {
		const pool = this._getPool(connectionId);
		const cols = await pool.request().query(`
			USE [${database}];
			SELECT c.name AS column_name,
				t.name AS data_type,
				c.max_length,
				c.is_nullable,
				COLUMNPROPERTY(c.object_id, c.name, 'IsIdentity') AS is_identity
			FROM sys.columns c
			INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
			INNER JOIN sys.tables tb ON c.object_id = tb.object_id
			INNER JOIN sys.schemas s ON tb.schema_id = s.schema_id
			WHERE s.name='${schema}' AND tb.name='${table}'
			ORDER BY c.column_id;
		`);
		const lines = cols.recordset.map(col => {
			const len = (col.max_length > 0 && col.max_length !== 0x7fff) ? `(${col.max_length})` : '';
			const nullable = col.is_nullable ? 'NULL' : 'NOT NULL';
			const identity = col.is_identity ? ' IDENTITY(1,1)' : '';
			return `  [${col.column_name}] ${col.data_type}${len}${identity} ${nullable}`;
		});
		return `CREATE TABLE [${schema}].[${table}] (\n${lines.join(',\n')}\n);`;
	}

	async getRoutineDefinition(connectionId, database, schema, name) {
		const pool = this._getPool(connectionId);
		const res = await pool.request().query(`
			USE [${database}];
			SELECT OBJECT_DEFINITION(OBJECT_ID('${schema}.${name}')) AS definition;
		`);
		return (res.recordset[0] && res.recordset[0].definition) || '';
	}
}

module.exports = { MssqlRepository };


