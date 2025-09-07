/* eslint-env browser */
/* global acquireVsCodeApi, window, document */
const vscode = acquireVsCodeApi();

function $(id) { return document.getElementById(id); }

function escapeHtml(v) {
	if (v === null || v === undefined) return '';
	return String(v).replace(/[&<>"']+/g, s => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[s]));
}

function renderQueryGrid(result, targetId) {
	const container = $(targetId || 'results');
	const cols = result.columns || [];
	const rows = result.recordset || [];
	let html = '<table class="vscode-grid">';
	html += '<thead><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead>';
	html += '<tbody>' + rows.map(r => '<tr>' + cols.map(c => `<td>${escapeHtml(r[c])}</td>`).join('') + '</tr>').join('') + '</tbody>';
	html += '</table>';
	container.innerHTML = html;
}

function renderAdminerLayout(info) {
	const root = $('app');
	root.innerHTML = `
		<div class="adminer">
			<div id="menu">
				<h1><span id="h1">Adminer</span></h1>
				<form id="menu-selectors" action="">
					<p id="dbs">
						<span title="database">DB</span>:
						<select id="dbSelect"></select>
						<button type="button" id="refresh" class="btn-secondary" title="Refresh">Refresh</button>
					</p>
				</form>
				<div id="filter-schema-container">
					<input type="search" id="filter-schema-input" placeholder="Search schemas..." value="">
					<div id="filter-schema-count"></div>
				</div>
				<ul id="db_schemas"></ul>
			</div>
			<div id="content">
				<p id="breadcrumb">${escapeHtml(info.server || '')}</p>
				<h2 id="schemaTitle">Schema</h2>
				<div id="ajaxstatus" class="hidden"></div>
				<div class="tabs" id="content-tabs">
					<div class="tab active" data-tab="tab-tv">Tables & Views</div>
					<div class="tab" data-tab="tab-procs">Stored Procedures</div>
					<div class="tab" data-tab="tab-funcs">Functions</div>
				</div>
				<div class="tabpane active" id="tab-tv">
					<div class="form-group" style="display:flex; align-items:center; gap:8px;">
						<input type="search" id="filter-table-input" placeholder="Filter tables/views..." />
						<span id="filter-table-count" class="info"></span>
					</div>
					<div class="scrollable">
						<table id="filter-table-list" cellspacing="0" class="nowrap checkable">
							<thead><tr class="wrap"><td></td><th>Name</th><th>Structure</th><td>Type</td></tr></thead>
							<tbody id="tableRows"></tbody>
						</table>
					</div>
				</div>
				<div class="tabpane" id="tab-procs">
					<div class="form-group" style="display:flex; align-items:center; gap:8px;">
						<input type="search" id="filter-proc-input" placeholder="Filter procedures..." />
						<span id="filter-proc-count" class="info"></span>
					</div>
					<ul id="procs" class="list"></ul>
				</div>
				<div class="tabpane" id="tab-funcs">
					<div class="form-group" style="display:flex; align-items:center; gap:8px;">
						<input type="search" id="filter-func-input" placeholder="Filter functions..." />
						<span id="filter-func-count" class="info"></span>
					</div>
					<ul id="funcs" class="list"></ul>
				</div>
				<div class="tabs" id="sql-tabs" style="margin-top:12px;">
					<div class="tab active" data-tab="pane-sql">SQL</div>
					<div class="tab" data-tab="pane-data">Table Data</div>
				</div>
				<div class="tabpane active" id="pane-sql">
					<div class="sqlbox">
						<textarea id="sqlInput"></textarea>
						<div class="button-container">
							<button class="btn-primary" id="runQuery">Run</button>
						</div>
						<div id="resultsMeta" class="description"></div>
						<div id="results" class="results"></div>
					</div>
				</div>
				<div class="tabpane" id="pane-data">
					<div id="dataMeta" class="description"></div>
					<div id="dataResults" class="results"></div>
					<div class="pagination">
						<button class="btn-secondary" id="dataPrev">Prev</button>
						<span class="info" id="dataPageInfo"></span>
						<button class="btn-secondary" id="dataNext">Next</button>
					</div>
				</div>
			</div>
		</div>
	`;

	vscode._page = 0; vscode._limit = 100; vscode._lastSql = null;
	vscode._dataPage = 0; vscode._currentTable = null; vscode._currentSchema = null;
	vscode.postMessage({ type: 'listDatabases' });

	// Tabs in content
	document.querySelectorAll('#content-tabs .tab').forEach(tab => {
		tab.addEventListener('click', () => {
			document.querySelectorAll('#content-tabs .tab').forEach(t => t.classList.remove('active'));
			document.querySelectorAll('.tabpane').forEach(p => p.classList.remove('active'));
			tab.classList.add('active');
			document.getElementById(tab.dataset.tab).classList.add('active');
		});
	});
	// Tabs for SQL/Data
	document.querySelectorAll('#sql-tabs .tab').forEach(tab => {
		tab.addEventListener('click', () => {
			document.querySelectorAll('#sql-tabs .tab').forEach(t => t.classList.remove('active'));
			document.getElementById('pane-sql').classList.remove('active');
			document.getElementById('pane-data').classList.remove('active');
			tab.classList.add('active');
			document.getElementById(tab.dataset.tab).classList.add('active');
		});
	});

	$('dbSelect').addEventListener('change', () => {
		const db = $('dbSelect').value;
		vscode.postMessage({ type: 'listSchemas', database: db });
	});
	$('refresh').addEventListener('click', () => {
		const db = $('dbSelect').value;
		const schemaBtn = document.querySelector('#db_schemas button.schema.selected');
		if (schemaBtn) {
			vscode.postMessage({ type: 'listObjects', database: db, schema: schemaBtn.dataset.schema });
		} else {
			vscode.postMessage({ type: 'listSchemas', database: db });
		}
	});
	$('filter-schema-input').addEventListener('input', filterSchemaList);
	$('filter-table-input').addEventListener('input', filterTableRows);
	$('filter-proc-input').addEventListener('input', () => filterSimpleList('procs', 'filter-proc-input', 'filter-proc-count'));
	$('filter-func-input').addEventListener('input', () => filterSimpleList('funcs', 'filter-func-input', 'filter-func-count'));
	$('runQuery').addEventListener('click', () => {
		const db = $('dbSelect').value;
		const sql = $('sqlInput').value || 'SELECT 1 AS [one]';
		vscode._lastSql = sql; vscode._page = 0;
		$('resultsMeta').textContent = 'Running...';
		vscode.postMessage({ type: 'runQuery', database: db, sql, offset: 0, limit: vscode._limit });
	});
	$('dataPrev').addEventListener('click', () => paginateData(-1));
	$('dataNext').addEventListener('click', () => paginateData(1));
}

function renderLogin() {
	const root = $('app');
	const meta = root.getAttribute('data-conn');
	const info = meta ? JSON.parse(meta) : {};
	if (info.connected) {
		renderAdminerLayout(info);
		return;
	}
	root.innerHTML = `
		<div class="container">
			<h2>Connect</h2>
			<div class="group">
				<label>Server</label>
				<input id="server" type="text" value="${info.server || ''}" disabled />
			</div>
			<div class="group">
				<label>Database</label>
				<input id="database" type="text" value="${info.database || ''}" disabled />
			</div>
			<div class="group">
				<label>User</label>
				<input id="user" type="text" value="${info.user || ''}" />
			</div>
			<div class="group">
				<label>Password</label>
				<input id="pwd" type="password" placeholder="Password" />
			</div>
			<div class="actions">
				<button id="connect">Connect</button>
			</div>
			<div id="status" class="status"></div>
		</div>
	`;
	$('connect').addEventListener('click', () => {
		const password = $('pwd').value;
		const user = $('user').value;
		vscode.postMessage({ type: 'connect', password, user });
	});
}

function paginateData(delta) {
	if (!vscode._currentTable || !vscode._currentSchema) return;
	const db = $('dbSelect').value;
	vscode._dataPage = Math.max(0, (vscode._dataPage || 0) + delta);
	const offset = (vscode._dataPage) * (vscode._limit || 100);
	$('dataPageInfo').textContent = `Page ${vscode._dataPage + 1}`;
	const sql = `SELECT * FROM [${vscode._currentSchema}].[${vscode._currentTable}]`;
	vscode.postMessage({ type: 'runQuery', database: db, sql, offset, limit: (vscode._limit || 100) });
}

window.addEventListener('message', (e) => {
	const msg = e.data;
	if (msg.type === 'connectionStatus') {
		if (msg.connected) {
			const root = $('app');
			const info = JSON.parse(root.getAttribute('data-conn'));
			info.connected = true;
			root.setAttribute('data-conn', JSON.stringify(info));
			renderAdminerLayout(info);
		} else {
			const el = $('status');
			if (el) el.textContent = 'Failed to connect';
		}
	}
	if (msg.type === 'error') {
		const human = typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message);
		const el = $('status');
		if (el) el.textContent = human || 'Error';
	}
	if (msg.type === 'databases') {
		const sel = $('dbSelect');
		sel.innerHTML = msg.items.map(n => `<option value="${n}">${n}</option>`).join('');
		sel.dispatchEvent(new Event('change'));
	}
	if (msg.type === 'schemas') {
		const list = $('db_schemas');
		list.innerHTML = msg.items.map(n => `<li class="filter-schema-name"><button class="link schema" data-schema="${n}">${n}</button></li>`).join('');
		filterSchemaList();
		const first = list.querySelector('button.schema');
		if (first) first.click();
	}
	if (msg.type === 'objects') {
		const rows = [];
		(msg.items.tables || []).forEach(t => rows.push({ name: t.name, kind: 'USER_TABLE' }));
		(msg.items.views || []).forEach(v => rows.push({ name: v.name, kind: 'VIEW' }));
		rows.sort((a,b) => a.name.localeCompare(b.name));
		const tbody = $('tableRows');
		tbody.innerHTML = rows.map(r => `
			<tr class="filter-table-row">
				<td></td>
				<th><button class="link filter-tablename" data-open="${r.name}">${r.name}</button></th>
				<th><button class="link" data-structure="${r.name}">${r.kind === 'VIEW' ? 'View structure' : 'Table structure'}</button></th>
				<td>${r.kind}</td>
			</tr>`).join('');
		const currentSchema = $('db_schemas').querySelector('button.schema.selected')?.dataset.schema || $('db_schemas').querySelector('button.schema')?.dataset.schema;
		document.querySelectorAll('[data-open]').forEach(btn => {
			btn.addEventListener('click', () => {
				const db = $('dbSelect').value;
				const name = btn.getAttribute('data-open');
				const schema = currentSchema;
				vscode._currentSchema = schema; vscode._currentTable = name; vscode._dataPage = 0;
				// Switch to Data tab
				document.querySelectorAll('#sql-tabs .tab').forEach(t => t.classList.remove('active'));
				document.getElementById('pane-sql').classList.remove('active');
				document.getElementById('pane-data').classList.add('active');
				document.querySelector('#sql-tabs .tab[data-tab="pane-data"]').classList.add('active');
				$('dataPageInfo').textContent = 'Page 1';
				const sql = `SELECT * FROM [${schema}].[${name}]`;
				vscode.postMessage({ type: 'runQuery', database: db, sql, offset: 0, limit: (vscode._limit || 100) });
			});
		});
		document.querySelectorAll('[data-structure]').forEach(btn => {
			btn.addEventListener('click', () => {
				const db = $('dbSelect').value;
				const name = btn.getAttribute('data-structure');
				const schema = currentSchema;
				vscode.postMessage({ type: 'getTableDDL', database: db, schema, table: name });
			});
		});
		// Procs and funcs lists
		$('procs').innerHTML = (msg.items.procedures || []).map(o => `<li><button class="link proc" data-name="${o.name}">${o.name}</button></li>`).join('');
		$('funcs').innerHTML = (msg.items.functions || []).map(o => `<li><button class="link func" data-name="${o.name}">${o.name}</button></li>`).join('');
		document.querySelectorAll('button.proc').forEach(b => b.addEventListener('click', () => openRoutineDef('PROC', b.getAttribute('data-name'))));
		document.querySelectorAll('button.func').forEach(b => b.addEventListener('click', () => openRoutineDef('FUNC', b.getAttribute('data-name'))));
	}
	if (msg.type === 'queryResult') {
		// Route to data or sql based on context
		if (vscode._currentTable) {
			renderQueryGrid(msg.result, 'dataResults');
			$('dataMeta').textContent = `${vscode._currentSchema}.${vscode._currentTable} — ${msg.result.recordset.length} rows`;
		} else {
			renderQueryGrid(msg.result, 'results');
			$('resultsMeta').textContent = `${msg.result.recordset.length} rows`;
		}
	}
	if (msg.type === 'ddl') {
		$('results').innerHTML = `<pre class="code">${escapeHtml(msg.ddl || '')}</pre>`;
		$('resultsMeta').textContent = `${msg.schema}.${msg.name}`;
	}
});

function openRoutineDef(kind, name) {
	const db = $('dbSelect').value;
	const schema = document.querySelector('#db_schemas button.schema.selected')?.dataset.schema || '';
	vscode.postMessage({ type: 'getRoutineDef', database: db, schema, name });
}

function boot() {
	const root = $('app');
	const meta = root.getAttribute('data-conn');
	const info = meta ? JSON.parse(meta) : {};
	if (info.connected) {
		renderAdminerLayout(info);
	} else {
		renderLogin();
	}
}

boot();

// Helpers
function filterSchemaList() {
	const q = ($('filter-schema-input').value || '').toLowerCase();
	let count = 0;
	document.querySelectorAll('#db_schemas li').forEach(li => {
		const btn = li.querySelector('button.schema');
		const show = btn.textContent.toLowerCase().includes(q);
		li.style.display = show ? '' : 'none';
		if (show) count++;
	});
	$('filter-schema-count').textContent = count ? `${count} schema(s)` : '';
	document.querySelectorAll('button.schema').forEach(b => {
		if (b._bound) return;
		b._bound = true;
		b.addEventListener('click', () => {
			document.querySelectorAll('button.schema').forEach(x => x.classList.remove('selected'));
			b.classList.add('selected');
			$('schemaTitle').textContent = `Schema: ${b.dataset.schema}`;
			const db = $('dbSelect').value;
			vscode.postMessage({ type: 'listObjects', database: db, schema: b.dataset.schema });
		});
	});
}

function filterTableRows() {
	const q = ($('filter-table-input').value || '').toLowerCase();
	let visible = 0;
	document.querySelectorAll('#tableRows tr').forEach(tr => {
		const name = tr.querySelector('.filter-tablename').textContent.toLowerCase();
		const show = name.includes(q);
		tr.style.display = show ? '' : 'none';
		if (show) visible++;
	});
	$('filter-table-count').textContent = visible ? `${visible} match(es)` : '';
}

function filterSimpleList(listId, inputId, countId) {
	const q = ($(inputId).value || '').toLowerCase();
	let visible = 0;
	document.querySelectorAll(`#${listId} li`).forEach(li => {
		const show = li.textContent.toLowerCase().includes(q);
		li.style.display = show ? '' : 'none';
		if (show) visible++;
	});
	$(countId).textContent = visible ? `${visible} match(es)` : '';
}


