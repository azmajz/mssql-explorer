const vscode = require('vscode');
const { EXTENSION_CONFIG } = require('./constants');

class GridViewerPanel {
    static panels = new Map(); // key: `${db}.${schema}.${name}`

    static createOrShow(connectionPool, databaseName, schema, name, kind) {
        const key = `${databaseName}.${schema}.${name}`;
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
        
        if (GridViewerPanel.panels.has(key)) {
            const existing = GridViewerPanel.panels.get(key);
            existing.panel.reveal(column);
            existing.update(connectionPool, databaseName, schema, name, kind);
            return existing;
        }
        
        const panel = vscode.window.createWebviewPanel(
            'mssqlGridViewer',
            key,
            column || vscode.ViewColumn.Active,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        
        const instance = new GridViewerPanel(panel, connectionPool, databaseName, schema, name, kind);
        GridViewerPanel.panels.set(key, instance);
        return instance;
    }

    constructor(panel, connectionPool, databaseName, schema, name, kind) {
        this.panel = panel;
        this.connectionPool = connectionPool;
        this.databaseName = databaseName;
        this.schema = schema;
        this.name = name;
        this.kind = kind;

        this.panel.onDidDispose(() => {
            GridViewerPanel.panels.delete(`${this.databaseName}.${this.schema}.${this.name}`);
        });

        this.refresh();
    }

    async update(connectionPool, databaseName, schema, name, kind) {
        this.connectionPool = connectionPool;
        this.databaseName = databaseName;
        this.schema = schema;
        this.name = name;
        this.kind = kind;
        await this.refresh();
    }

    async refresh() {
        const query = `USE [${this.databaseName}]; SELECT TOP ${EXTENSION_CONFIG.GRID_VIEWER.MAX_ROWS} * FROM [${this.schema}].[${this.name}]`;
        let html = '';
        try {
            const result = await this.connectionPool.request().query(query);
            html = this.renderGrid(result.recordset);
        } catch (err) {
            html = `<div class="error">${err.message}</div>`;
        }
        this.panel.title = `${this.databaseName}.${this.schema}.${this.name}`;
        this.panel.webview.html = this.wrapHtml(html, query);
    }

    renderGrid(rows) {
        if (!rows || rows.length === 0) { return '<div>No rows.</div>'; }
        const cols = Object.keys(rows[0]);
        let thead = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
        let tbody = rows.map(r => '<tr>' + cols.map(c => {
            const val = String(r[c] ?? '');
            const maxLength = EXTENSION_CONFIG.GRID_VIEWER.MAX_CELL_LENGTH;
            const truncated = val.length > maxLength ? `${val.slice(0, maxLength)}…` : val;
            const title = this.escape(val);
            const cell = this.escape(truncated);
            const moreAttr = val.length > maxLength ? ` data-full="${title}" class="trunc"` : '';
            return `<td${moreAttr} title="${title}">${cell}</td>`;
        }).join('') + '</tr>').join('');
        return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
    }

    escape(s) { return s.replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }

    wrapHtml(content, query) {
        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-editor-background);margin:0;padding:12px}
.error{color:var(--vscode-errorForeground);background:var(--vscode-inputValidation-errorBackground);padding:8px;border-radius:3px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid var(--vscode-panel-border);padding:6px;text-align:left}
th{background:var(--vscode-panel-background)}
tr:nth-child(even){background:var(--vscode-list-hoverBackground)}
.trunc{cursor:pointer}
.query{font-family:monospace;color:var(--vscode-descriptionForeground);margin-bottom:8px}
</style>
</head>
<body>
<div class="query">${this.escape(query)}</div>
${content}
<script>
document.addEventListener('click', (e) => {
  const td = e.target.closest('td.trunc');
  if (td && td.dataset.full) {
    const full = td.dataset.full;
    const showingFull = td.dataset.showing === '1';
    if (showingFull) {
      td.innerText = full.slice(0, 100) + '…';
      td.dataset.showing = '0';
    } else {
      td.innerText = full;
      td.dataset.showing = '1';
    }
  }
});
</script>
</body>
</html>`;
    }
}

module.exports = { GridViewerPanel };


