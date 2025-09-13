const vscode = require('vscode');
const { EXTENSION_CONFIG } = require('./constants');

class AdvancedGridViewerPanel {
    static panels = new Map(); // key: `${db}.${schema}.${name}`

    static createOrShow(connectionPool, databaseName, schema, name, kind, options = {}) {
        const key = `${databaseName}.${schema}.${name}`;
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
        
        if (AdvancedGridViewerPanel.panels.has(key)) {
            const existing = AdvancedGridViewerPanel.panels.get(key);
            existing.panel.reveal(column);
            existing.update(connectionPool, databaseName, schema, name, kind, options);
            return existing;
        }
        
        const panel = vscode.window.createWebviewPanel(
            'mssqlAdvancedGridViewer',
            key,
            column || vscode.ViewColumn.Active,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        
        const instance = new AdvancedGridViewerPanel(panel, connectionPool, databaseName, schema, name, kind, options);
        AdvancedGridViewerPanel.panels.set(key, instance);
        return instance;
    }

    constructor(panel, connectionPool, databaseName, schema, name, kind, options = {}) {
        this.panel = panel;
        this.connectionPool = connectionPool;
        this.databaseName = databaseName;
        this.schema = schema;
        this.name = name;
        this.kind = kind;
        this.options = {
            selectedColumns: options.selectedColumns || [],
            orderBy: options.orderBy || '',
            currentPage: 1,
            pageSize: 100,
            searchTerm: '',
            ...options
        };
        this.tableColumns = [];
        this.currentData = [];
        this.currentQuery = '';
        this.totalRows = 0;
        this.queryExecutionTime = 0;
        this.showQuery = true;

        this.panel.onDidDispose(() => {
            AdvancedGridViewerPanel.panels.delete(`${this.databaseName}.${this.schema}.${this.name}`);
        });

        this.setupMessageHandling();
        this.initialize();
    }

    setupMessageHandling() {
        this.panel.webview.onDidReceiveMessage(async (message) => {
            console.log('Received message:', message);
            switch (message.command) {
                case 'getTableSchema':
                    console.log('Loading table schema...');
                    await this.loadTableSchema();
                    break;
                case 'updateColumns':
                    console.log('Updating columns:', message.columns);
                    this.options.selectedColumns = message.columns;
                    this.options.currentPage = 1; // Reset to first page
                    await this.refresh();
                    break;
                case 'updateOrderBy':
                    console.log('Updating order by:', message.orderBy);
                    this.options.orderBy = message.orderBy;
                    this.options.currentPage = 1; // Reset to first page
                    await this.refresh();
                    break;
                case 'changePage':
                    console.log('Changing page to:', message.page);
                    this.options.currentPage = message.page;
                    await this.refresh();
                    break;
                case 'changePageSize':
                    console.log('Changing page size to:', message.pageSize);
                    this.options.pageSize = parseInt(message.pageSize) || 100;
                    this.options.currentPage = 1; // Reset to first page
                    await this.refresh();
                    break;
                case 'search':
                    console.log('Performing search with term:', message.searchTerm);
                    this.options.searchTerm = message.searchTerm;
                    this.options.selectedColumns = message.selectedColumns;
                    this.options.orderBy = message.orderBy;
                    this.options.currentPage = message.currentPage || 1;
                    this.options.pageSize = message.pageSize || 100;
                    await this.refresh();
                    break;
                case 'openQueryEditor':
                    console.log('Opening query editor with query:', message.query);
                    // Open a new document with the query
                    const doc = await vscode.workspace.openTextDocument({
                        content: message.query,
                        language: 'sql'
                    });
                    await vscode.window.showTextDocument(doc);
                    break;
                default:
                    console.log('Unknown message command:', message.command);
            }
        });
    }

    async initialize() {
        await this.loadTableSchema();
        await this.refresh();
    }

    async update(connectionPool, databaseName, schema, name, kind, options = {}) {
        this.connectionPool = connectionPool;
        this.databaseName = databaseName;
        this.schema = schema;
        this.name = name;
        this.kind = kind;
        this.options = { ...this.options, ...options };
        await this.initialize();
    }

    async loadTableSchema() {
        try {
            console.log('Loading table schema for:', this.databaseName, this.schema, this.name);
            const query = `
                USE [${this.databaseName}];
                SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    IS_NULLABLE,
                    CHARACTER_MAXIMUM_LENGTH,
                    COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = '${this.schema}' 
                AND TABLE_NAME = '${this.name}'
                ORDER BY ORDINAL_POSITION
            `;
            
            const result = await this.connectionPool.request().query(query);
            this.tableColumns = result.recordset;
            console.log('Loaded columns:', this.tableColumns.length);
            
            // If no columns are selected, select all by default
            if (this.options.selectedColumns.length === 0) {
                this.options.selectedColumns = this.tableColumns.map(col => col.COLUMN_NAME);
                console.log('Selected all columns by default:', this.options.selectedColumns);
            }

            await this.sendSchemaToWebview();
        } catch (error) {
            console.error('Error loading table schema:', error);
        }
    }

    async sendSchemaToWebview() {
        console.log('Sending schema to webview:', {
            columns: this.tableColumns.length,
            selectedColumns: this.options.selectedColumns.length
        });
        await this.panel.webview.postMessage({
            command: 'updateSchema',
            columns: this.tableColumns,
            selectedColumns: this.options.selectedColumns
        });
    }

    async refresh() {
        if (this.tableColumns.length === 0) {
            await this.loadTableSchema();
        }

        // Get total row count first
        await this.getTotalRowCount();
        
        this.currentQuery = this.buildQuery();
        let html = '';
        
        try {
            const startTime = Date.now();
            const result = await this.connectionPool.request().query(this.currentQuery);
            this.queryExecutionTime = (Date.now() - startTime) / 1000; // Convert to seconds
            this.currentData = result.recordset;
            html = this.renderAdvancedGrid(this.currentData);
        } catch (err) {
            this.queryExecutionTime = 0;
            html = `<div class="error">${err.message}</div>`;
        }
        
        const totalPages = Math.ceil(this.totalRows / this.options.pageSize);
        this.panel.title = `${this.databaseName}.${this.schema}.${this.name} (Page ${this.options.currentPage}/${totalPages}, ${this.totalRows} total rows)`;
        this.panel.webview.html = this.wrapAdvancedHtml(html, this.currentQuery, totalPages, this.queryExecutionTime);
    }

    async getTotalRowCount() {
        try {
            let countQuery = `USE [${this.databaseName}]; SELECT COUNT(*) as total FROM [${this.schema}].[${this.name}]`;
            
            // Add search WHERE clause if search term exists
            if (this.options.searchTerm && this.options.searchTerm.trim()) {
                const searchTerm = this.options.searchTerm.trim();
                const searchConditions = this.options.selectedColumns.map(col => 
                    `[${col}] LIKE '%${searchTerm.replace(/'/g, "''")}%'`
                ).join(' OR ');
                countQuery += ` WHERE (${searchConditions})`;
            }
            
            const result = await this.connectionPool.request().query(countQuery);
            this.totalRows = result.recordset[0].total;
        } catch (error) {
            console.error('Error getting total row count:', error);
            this.totalRows = 0;
        }
    }

    buildQuery() {
        const selectedCols = this.options.selectedColumns.length > 0 
            ? this.options.selectedColumns.map(col => `[${col}]`).join(', ')
            : '*';
        
        let query = `USE [${this.databaseName}]; `;
        
        // Use TOP for first page, OFFSET/FETCH for subsequent pages (Adminer-like)
        if (this.options.currentPage === 1) {
            query += `SELECT TOP (${this.options.pageSize}) ${selectedCols} FROM [${this.schema}].[${this.name}]`;
        } else {
            query += `SELECT ${selectedCols} FROM [${this.schema}].[${this.name}]`;
        }
        
        // Add search WHERE clause if search term exists
        if (this.options.searchTerm && this.options.searchTerm.trim()) {
            const searchTerm = this.options.searchTerm.trim();
            const searchConditions = this.options.selectedColumns.map(col => 
                `[${col}] LIKE '%${searchTerm.replace(/'/g, "''")}%'`
            ).join(' OR ');
            query += ` WHERE (${searchConditions})`;
        }
        
        if (this.options.orderBy.trim()) {
            query += ` ORDER BY ${this.options.orderBy}`;
        } else {
            // Default ordering for consistent pagination
            const firstCol = this.options.selectedColumns.length > 0 ? this.options.selectedColumns[0] : '1';
            query += ` ORDER BY [${firstCol}]`;
        }
        
        // Add OFFSET/FETCH for pages after the first
        if (this.options.currentPage > 1) {
            const offset = (this.options.currentPage - 1) * this.options.pageSize;
            query += ` OFFSET ${offset} ROWS FETCH NEXT ${this.options.pageSize} ROWS ONLY`;
        }
        
        return query;
    }


    renderAdvancedGrid(rows) {
        if (!rows || rows.length === 0) { 
            return '<div class="no-data">No rows found.</div>'; 
        }
        
        const cols = Object.keys(rows[0]);
        let thead = '<tr>' + cols.map(c => `<th class="sortable" data-column="${c}">${c} <span class="sort-icon">↕</span></th>`).join('') + '</tr>';
        let tbody = rows.map((r, index) => '<tr>' + cols.map(c => {
            const val = String(r[c] ?? '');
            const maxLength = EXTENSION_CONFIG.GRID_VIEWER.MAX_CELL_LENGTH;
            const truncated = val.length > maxLength ? `${val.slice(0, maxLength)}…` : val;
            const title = this.escape(val);
            let cell = this.escape(truncated);
            
            // Highlight search terms if search is active
            if (this.options.searchTerm && this.options.searchTerm.trim()) {
                cell = this.highlightSearchTerm(cell, this.options.searchTerm);
            }
            
            const moreAttr = val.length > maxLength ? ` data-full="${title}" class="trunc"` : '';
            return `<td${moreAttr} title="${title}" data-row="${index}">${cell}</td>`;
        }).join('') + '</tr>').join('');
        
        return `<table id="dataTable"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
    }
    
    highlightSearchTerm(text, searchTerm) {
        if (!searchTerm) return text;
        
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }


    escape(s) { 
        return s.replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); 
    }

    wrapAdvancedHtml(content, query, totalPages, executionTime = 0) {
        const currentPage = this.options.currentPage;
        const pageSize = this.options.pageSize;
        const startRow = (currentPage - 1) * pageSize + 1;
        const endRow = Math.min(currentPage * pageSize, this.totalRows);
        
        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { box-sizing: border-box; }
body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-editor-background);margin:0;padding:0;line-height:1.4}
.container{display:flex;flex-direction:column;height:100vh}
.header{background:var(--vscode-panel-background);border-bottom:1px solid var(--vscode-panel-border);padding:16px;flex-shrink:0;box-shadow:0 2px 4px rgba(0,0,0,0.1)}
.toolbar{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.control-group{display:flex;align-items:center;gap:8px;position:relative}
.control-group label{font-weight:600;white-space:nowrap;color:var(--vscode-foreground);font-size:13px}
.control-group input, .control-group select{background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);padding:6px 10px;border-radius:4px;font-size:13px;min-width:120px}
.control-group input:focus, .control-group select:focus{outline:1px solid var(--vscode-focusBorder);border-color:var(--vscode-focusBorder)}
.search-container{display:flex;align-items:center;gap:4px;position:relative}
.search-input{min-width:300px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);padding:8px 12px;border-radius:4px;font-size:13px;position:relative;flex:1}
.search-input:focus{outline:1px solid var(--vscode-focusBorder);border-color:var(--vscode-focusBorder)}
.search-input::placeholder{color:var(--vscode-descriptionForeground);font-style:italic}
.search-highlight{background:var(--vscode-textBlockQuote-background);padding:1px 2px;border-radius:2px;font-weight:600}
.search-results{color:var(--vscode-descriptionForeground);font-size:12px;margin-left:8px;font-weight:500}
.query-display{background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);border-radius:4px;padding:12px;margin:12px 0;font-family:var(--vscode-editor-font-family, monospace);font-size:12px}
.query-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--vscode-panel-border)}
.query-title{font-weight:600;color:var(--vscode-foreground);font-size:13px}
.query-actions{display:flex;gap:8px}
.query-text{color:var(--vscode-foreground);white-space:pre-wrap;word-break:break-all;line-height:1.4}
.query-time{color:var(--vscode-descriptionForeground);font-size:11px;font-style:italic}
.query-edit-btn{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:none;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px;font-weight:500}
.query-edit-btn:hover{background:var(--vscode-button-secondaryHoverBackground)}
.btn{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s ease;display:inline-flex;align-items:center;gap:6px}
.btn:hover{background:var(--vscode-button-hoverBackground);transform:translateY(-1px)}
.btn.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
.btn.secondary:hover{background:var(--vscode-button-secondaryHoverBackground)}
.btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
.btn-small{padding:6px 12px;font-size:12px}
.pagination{display:flex;align-items:center;gap:8px;margin-top:8px;justify-content:space-between}
.pagination-controls{display:flex;gap:6px}
.pagination button{min-width:36px;height:36px;padding:6px 12px;font-size:12px}
.page-info{color:var(--vscode-descriptionForeground);font-size:12px;font-weight:500}
.content{flex:1;overflow:auto;padding:0;background:var(--vscode-editor-background)}
.error{color:var(--vscode-errorForeground);background:var(--vscode-inputValidation-errorBackground);padding:12px;border-radius:4px;margin:16px;border-left:4px solid var(--vscode-errorForeground)}
.no-data{text-align:center;padding:60px 20px;color:var(--vscode-descriptionForeground);font-size:14px}
table{border-collapse:collapse;width:100%;font-size:12px;background:var(--vscode-editor-background)}
th,td{border:1px solid var(--vscode-panel-border);padding:8px 10px;text-align:left;position:relative;vertical-align:top}
th{background:var(--vscode-panel-background);font-weight:600;cursor:pointer;user-select:none;color:var(--vscode-foreground);font-size:12px;text-transform:uppercase;letter-spacing:0.5px}
th:hover{background:var(--vscode-list-hoverBackground)}
th.sortable{position:relative;transition:background-color 0.2s ease}
th.sortable:hover{background:var(--vscode-list-hoverBackground)}
.sort-icon{opacity:0.6;margin-left:6px;font-size:10px}
th.sorted-asc .sort-icon::after{content:'▲';opacity:1;color:var(--vscode-foreground)}
th.sorted-desc .sort-icon::after{content:'▼';opacity:1;color:var(--vscode-foreground)}
tr:nth-child(even){background:var(--vscode-list-hoverBackground)}
tr:hover{background:var(--vscode-list-activeSelectionBackground)}
td{color:var(--vscode-foreground);font-size:12px;line-height:1.3}
.trunc{cursor:pointer;position:relative}
.trunc:hover{background:var(--vscode-textBlockQuote-background);border-radius:2px}
.column-selector{max-height:400px;overflow-y:auto;border:1px solid var(--vscode-panel-border);border-radius:6px;background:var(--vscode-input-background);padding:12px;position:absolute;z-index:1000;margin-top:8px;min-width:450px;max-width:600px;box-shadow:0 4px 12px rgba(0,0,0,0.15);top:100%}
.column-selector-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--vscode-panel-border)}
.column-selector-title{font-weight:600;color:var(--vscode-foreground);font-size:14px}
.column-search{width:100%;margin-bottom:12px;padding:8px 12px;border:1px solid var(--vscode-input-border);border-radius:4px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);font-size:13px}
.column-search:focus{outline:1px solid var(--vscode-focusBorder);border-color:var(--vscode-focusBorder)}
.column-actions{display:flex;gap:8px;margin-bottom:12px}
.column-list{max-height:250px;overflow-y:auto;border:1px solid var(--vscode-panel-border);border-radius:4px;background:var(--vscode-editor-background)}
.column-item{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border);transition:background-color 0.2s ease}
.column-item:hover{background:var(--vscode-list-hoverBackground)}
.column-item:last-child{border-bottom:none}
.column-item input[type="checkbox"]{margin:0;width:16px;height:16px;cursor:pointer}
.column-name{flex:1;font-family:var(--vscode-editor-font-family, monospace);font-size:12px;color:var(--vscode-foreground);font-weight:500}
.column-type{color:var(--vscode-descriptionForeground);font-size:11px;background:var(--vscode-textBlockQuote-background);padding:2px 6px;border-radius:3px;font-family:monospace}
.column-nullable{color:var(--vscode-descriptionForeground);font-size:10px;font-style:italic}
.stats{display:flex;gap:16px;align-items:center;color:var(--vscode-descriptionForeground);font-size:12px}
.stat-item{display:flex;align-items:center;gap:4px}
.stat-value{font-weight:600;color:var(--vscode-foreground)}
.loading{display:flex;align-items:center;justify-content:center;padding:40px;color:var(--vscode-descriptionForeground)}
.loading::after{content:'';width:20px;height:20px;border:2px solid var(--vscode-panel-border);border-top:2px solid var(--vscode-foreground);border-radius:50%;animation:spin 1s linear infinite;margin-left:8px}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <div class="toolbar">
            <div class="control-group">
                <label>Columns:</label>
                <button class="btn" onclick="toggleColumnSelector()">
                    <span>📋</span>
                    Select Columns (${this.options.selectedColumns.length})
                </button>
                <div id="columnSelector" class="column-selector" style="display:none">
                    <div class="column-selector-header">
                        <div class="column-selector-title">Select Columns</div>
                        <button class="btn btn-small secondary" onclick="closeColumnSelector()">✕</button>
                    </div>
                    <input type="text" id="columnSearch" class="column-search" placeholder="Search columns..." onkeyup="filterColumns()">
                    <div class="column-actions">
                        <button class="btn btn-small" onclick="selectAllColumns()">Select All</button>
                        <button class="btn btn-small secondary" onclick="deselectAllColumns()">Clear All</button>
                        <button class="btn btn-small" onclick="applyColumnSelection()">Apply</button>
                    </div>
                    <div id="columnList" class="column-list"></div>
                </div>
            </div>
             <div class="control-group">
                 <label>Search:</label>
                 <div class="search-container">
                     <input type="text" id="searchInput" class="search-input" placeholder="Search in all columns..." onkeyup="handleSearch()" oninput="handleSearchInput()">
                     <button class="btn btn-small secondary" onclick="clearSearch()" id="clearSearchBtn" style="display:none" title="Clear search">✕</button>
                 </div>
             </div>
            <div class="control-group">
                <label>Page Size:</label>
                <select id="pageSizeSelect" onchange="changePageSize()">
                    <option value="50" ${pageSize === 50 ? 'selected' : ''}>50 rows</option>
                    <option value="100" ${pageSize === 100 ? 'selected' : ''}>100 rows</option>
                    <option value="200" ${pageSize === 200 ? 'selected' : ''}>200 rows</option>
                    <option value="500" ${pageSize === 500 ? 'selected' : ''}>500 rows</option>
                </select>
            </div>
             <div class="stats">
                 <div class="stat-item">
                     <span>📊</span>
                     <span class="stat-value">${this.totalRows.toLocaleString()}</span>
                     <span>${this.options.searchTerm ? 'matching rows' : 'total rows'}</span>
                 </div>
                 <div class="stat-item">
                     <span>📄</span>
                     <span class="stat-value">${totalPages}</span>
                     <span>pages</span>
                 </div>
                 ${this.options.searchTerm ? `<div class="stat-item search-results">
                     <span>🔍</span>
                     <span>Searching: "${this.options.searchTerm}"</span>
                 </div>` : ''}
             </div>
             <div class="control-group">
                 <button class="btn btn-small secondary" onclick="toggleQueryDisplay()" id="queryToggleBtn" title="Show/Hide executed query">
                     <span>📝</span>
                     Query
                 </button>
             </div>
        </div>
        <div class="pagination">
            <div class="pagination-controls">
                <button class="btn btn-small" onclick="changePage(1)" ${currentPage === 1 ? 'disabled' : ''}>⏮ First</button>
                <button class="btn btn-small" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>◀ Previous</button>
                <button class="btn btn-small" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next ▶</button>
                <button class="btn btn-small" onclick="changePage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>Last ⏭</button>
            </div>
            <div class="page-info">Page ${currentPage} of ${totalPages} • Rows ${startRow}-${endRow}</div>
         </div>
     </div>
     <div class="query-display" id="queryDisplay" style="display:none">
         <div class="query-header">
             <div class="query-title">Executed Query</div>
             <div class="query-actions">
                 <span class="query-time">(${executionTime.toFixed(3)} s)</span>
                 <button class="query-edit-btn" onclick="editQuery()">Edit</button>
                 <button class="query-edit-btn" onclick="copyQuery()">Copy</button>
                 <button class="query-edit-btn" onclick="toggleQueryDisplay()">Hide</button>
             </div>
         </div>
         <div class="query-text">${this.escape(query)}</div>
     </div>
     <div class="content">
         ${content}
     </div>
</div>
<script>
console.log('=== ADVANCED GRID VIEWER SCRIPT STARTING ===');
let currentSort = { column: null, direction: 'asc' };
let allColumns = [];
let searchTerm = '';
let searchTimeout = null;
let allData = [];

// Immediate test
console.log('Script is executing!');

// Initialize when DOM is ready
function initialize() {
    console.log('Advanced Grid Viewer script loaded');
    console.log('Testing webview functionality...');
    
    // Test if we can access DOM elements
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    console.log('Page size select element:', pageSizeSelect);
    if (pageSizeSelect) {
        console.log('Page size select value:', pageSizeSelect.value);
    }
    
    loadTableSchema();
}

// Run when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Store VSCode API instance once
let vscode = null;
try {
    vscode = acquireVsCodeApi();
    console.log('VSCode API acquired successfully');
} catch (error) {
    console.error('Failed to acquire VSCode API:', error);
}

function loadTableSchema() {
    console.log('Loading table schema...');
    if (vscode) {
        try {
            vscode.postMessage({ command: 'getTableSchema' });
        } catch (error) {
            console.error('Error in loadTableSchema:', error);
        }
    } else {
        console.error('VSCode API not available');
    }
}

window.changePage = function(page) {
    console.log('Changing page to:', page);
    if (vscode) {
        try {
            vscode.postMessage({ command: 'changePage', page });
        } catch (error) {
            console.error('Error in changePage:', error);
        }
    } else {
        console.error('VSCode API not available');
    }
};

window.changePageSize = function() {
    if (vscode) {
        try {
            const pageSize = document.getElementById('pageSizeSelect').value;
            console.log('Changing page size to:', pageSize);
            vscode.postMessage({ command: 'changePageSize', pageSize });
        } catch (error) {
            console.error('Error in changePageSize:', error);
        }
    } else {
        console.error('VSCode API not available');
    }
};

window.toggleColumnSelector = function() {
    const selector = document.getElementById('columnSelector');
    const isVisible = selector.style.display !== 'none';
    selector.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
        renderColumnSelector();
        // Focus search input
        setTimeout(() => {
            const searchInput = document.getElementById('columnSearch');
            if (searchInput) searchInput.focus();
        }, 100);
    }
};

window.closeColumnSelector = function() {
    const selector = document.getElementById('columnSelector');
    selector.style.display = 'none';
};

window.selectAllColumns = function() {
    allColumns.forEach(col => {
        col.selected = true;
    });
    renderColumnSelector();
};

window.deselectAllColumns = function() {
    allColumns.forEach(col => {
        col.selected = false;
    });
    renderColumnSelector();
};

window.applyColumnSelection = function() {
    updateColumns();
    closeColumnSelector();
};

window.handleSearchInput = function() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    
    if (searchInput && clearBtn) {
        if (searchInput.value.trim()) {
            clearBtn.style.display = 'inline-flex';
        } else {
            clearBtn.style.display = 'none';
        }
    }
};

window.handleSearch = function() {
    const searchInput = document.getElementById('searchInput');
    const newSearchTerm = searchInput.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // Debounce search to avoid too many requests
    searchTimeout = setTimeout(() => {
        if (newSearchTerm !== searchTerm) {
            searchTerm = newSearchTerm;
            performSearch();
        }
    }, 300);
};

window.clearSearch = function() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    
    if (searchInput) {
        searchInput.value = '';
    }
    if (clearBtn) {
        clearBtn.style.display = 'none';
    }
    searchTerm = '';
    performSearch();
};

window.editQuery = function() {
    const queryText = document.getElementById('queryText').textContent;
    if (vscode) {
        try {
            vscode.postMessage({ 
                command: 'openQueryEditor', 
                query: queryText 
            });
        } catch (error) {
            console.error('Error opening query editor:', error);
        }
    }
};

window.copyQuery = function() {
    const queryText = document.getElementById('queryText').textContent;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(queryText).then(() => {
            // Show brief feedback
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 1000);
        }).catch(err => {
            console.error('Failed to copy query:', err);
        });
    }
};

window.toggleQueryDisplay = function() {
    const queryDisplay = document.getElementById('queryDisplay');
    const toggleBtn = document.getElementById('queryToggleBtn');
    
    if (queryDisplay.style.display === 'none') {
        queryDisplay.style.display = 'block';
        toggleBtn.innerHTML = '<span>📝</span> Hide Query';
    } else {
        queryDisplay.style.display = 'none';
        toggleBtn.innerHTML = '<span>📝</span> Query';
    }
};

function performSearch() {
    if (!vscode) {
        console.error('VSCode API not available for search');
        return;
    }
    
    console.log('Performing search with term:', searchTerm);
    
    try {
        vscode.postMessage({
            command: 'search',
            searchTerm: searchTerm,
            selectedColumns: allColumns.filter(col => col.selected).map(col => col.COLUMN_NAME),
            orderBy: currentSort.column ? \`\${currentSort.column} \${currentSort.direction}\` : '',
            currentPage: 1, // Reset to first page when searching
            pageSize: parseInt(document.getElementById('pageSizeSelect').value)
        });
    } catch (error) {
        console.error('Error sending search message:', error);
    }
}


window.filterColumns = function() {
    const searchTerm = document.getElementById('columnSearch').value.toLowerCase();
    const items = document.querySelectorAll('.column-item');
    
    items.forEach(item => {
        const name = item.querySelector('.column-name').textContent.toLowerCase();
        const type = item.querySelector('.column-type').textContent.toLowerCase();
        const matches = name.includes(searchTerm) || type.includes(searchTerm);
        item.style.display = matches ? 'flex' : 'none';
    });
};

function renderColumnSelector() {
    const columnList = document.getElementById('columnList');
    if (!columnList) return;
    
    columnList.innerHTML = '';
    
    allColumns.forEach(col => {
        const item = document.createElement('div');
        item.className = 'column-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = col.selected;
        checkbox.onchange = () => {
            col.selected = checkbox.checked;
        };
        
        const name = document.createElement('span');
        name.className = 'column-name';
        name.textContent = col.COLUMN_NAME;
        
        const type = document.createElement('span');
        type.className = 'column-type';
        type.textContent = col.DATA_TYPE + (col.CHARACTER_MAXIMUM_LENGTH ? \`(\${col.CHARACTER_MAXIMUM_LENGTH})\` : '');
        
        const nullable = document.createElement('span');
        nullable.className = 'column-nullable';
        nullable.textContent = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        
        item.appendChild(checkbox);
        item.appendChild(name);
        item.appendChild(type);
        item.appendChild(nullable);
        columnList.appendChild(item);
    });
}

function updateColumns() {
    if (vscode) {
        try {
            const selected = allColumns.filter(col => col.selected).map(col => col.COLUMN_NAME);
            console.log('Updating columns to:', selected);
            vscode.postMessage({ command: 'updateColumns', columns: selected });
        } catch (error) {
            console.error('Error in updateColumns:', error);
        }
    } else {
        console.error('VSCode API not available');
    }
}

// Handle messages from extension
window.addEventListener('message', event => {
    const message = event.data;
    console.log('Received message in webview:', message);
    switch (message.command) {
        case 'updateSchema':
            console.log('Updating schema with columns:', message.columns);
            allColumns = message.columns.map(col => ({
                ...col,
                selected: message.selectedColumns.includes(col.COLUMN_NAME)
            }));
            console.log('All columns set to:', allColumns);
            break;
    }
});

// Table sorting
document.addEventListener('click', function(e) {
    if (e.target.closest('th.sortable')) {
        const th = e.target.closest('th');
        const column = th.dataset.column;
        
        if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'asc';
        }
        
        // Update UI
        document.querySelectorAll('th').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
        th.classList.add(\`sorted-\${currentSort.direction}\`);
        
        // Update order by
        if (vscode) {
            try {
                vscode.postMessage({ command: 'updateOrderBy', orderBy: \`\${column} \${currentSort.direction}\` });
            } catch (error) {
                console.error('Error in sorting:', error);
            }
        } else {
            console.error('VSCode API not available');
        }
    }
    
    // Handle truncated cell clicks
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

// Close column selector when clicking outside
document.addEventListener('click', function(e) {
    const selector = document.getElementById('columnSelector');
    const button = e.target.closest('button[onclick="toggleColumnSelector()"]');
    const selectorContainer = e.target.closest('.column-selector');
    
    if (selector && selector.style.display !== 'none' && !selectorContainer && !button) {
        closeColumnSelector();
    }
});

// Handle keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Escape key to clear search
    if (e.key === 'Escape') {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && document.activeElement === searchInput) {
            clearSearch();
        }
    }
});
</script>
</body>
</html>`;
    }
}

module.exports = { AdvancedGridViewerPanel };
