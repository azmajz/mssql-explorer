# this is the html from the side panel in my adminer.php make like same 
- for Goto links there it was opening the list of all the tables views SPs in the right main content..
```html
<div id="menu">
	<h1>
		<a href="https://www.adminer.org/" target="_blank" rel="noreferrer noopener" id="h1">Adminer</a> <span
			class="version">4.8.1</span>
	</h1>
	<form id="menu-selectors" style="" action="">
		<p id="dbs">
			<input type="hidden" name="mssql" value="localhost\SQLEXPRESS"><input type="hidden" name="username"
				value="sa"><span title="database">DB</span>: <select name="db">
				<option value=""></option>
				<option>EZChildTrack_T20250106</option>
				<option>SessionDB</option>
				<option>EZChildTrack_CustomerDB</option>
				<option>EZChildTrack_NewTrunk</option>
				<option>EZChildTrackDemo_T20240430</option>
				<option>EmployeeManagement</option>
				<option>EZChildTrack_Branch</option>
				<option>ReportServer</option>
				<option>ReportServerTempDB</option>
			</select>
			<script nonce="">mixin(qsl('select'), { onchange: dbChange });</script>
			<input type="submit" value="Use" class="hidden">
		</p>
	</form>
	<p class="links"><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;sql=">SQL command</a>
		<a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;import=">Import</a>
	</p>
	<p class="links">
		<a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;alltables">Tables</a>
		<a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;allroutines">Routines</a>
		<a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;allviews">Views</a>
		<a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;allfunctions">Functions</a>
	</p>
	<p class="links">
		<a href="#content">Goto Tables</a>
		<a href="#routines">Goto Routines</a>
	</p>
	<div id="filter-schema-container"><input type="search" id="filter-schema-input" placeholder="Search in 15 schemas..."
			value="">
		<script
			nonce="">mixin(qs('#filter-schema-input'), { onkeyup: debounce(filterDbSchemas) }); qs('#filter-schema-input').value = '';</script>
		<div id="filter-schema-count"></div>
	</div>
	<ul id="db_schemas" style="overflow: auto;">
		<script nonce="">mixin(qs('#db_schemas'));</script>
		<li class="filter-schema-name"><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;ns=dbo"
				class="select" title="Select schema">dbo</a> </li>
		<li class="filter-schema-name"><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;ns=guest"
				class="select" title="Select schema">guest</a> </li>
		<li class="filter-schema-name"><a
				href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;ns=INFORMATION_SCHEMA" class="select"
				title="Select schema">INFORMATION_SCHEMA</a> </li>
		<li class="filter-schema-name"><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;ns=sys"
				class="select" title="Select schema">sys</a> </li>
		<li class="filter-schema-name"><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;ns=RSExecRole"
				class="select" title="Select schema">RSExecRole</a> </li>
		<li class="filter-schema-name"><a
				href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;ns=NT+SERVICE%5CSQLServerReportingServices"
				class="select" title="Select schema">NT SERVICE\SQLServerReportingServices</a> </li>
		<li class="filter-schema-name"><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;ns=db_owner"
				class="select" title="Select schema">db_owner</a> </li>
		<li class="filter-schema-name"><a
				href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;ns=db_accessadmin" class="select"
				title="Select schema">db_accessadmin</a> </li>
		<li class="filter-schema-name"><a
				href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;ns=db_securityadmin" class="select"
				title="Select schema">db_securityadmin</a> </li>
		<li class="filter-schema-name"><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;ns=db_ddladmin"
				class="select" title="Select schema">db_ddladmin</a> </li>
		<li class="filter-schema-name"><a
				href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;ns=db_backupoperator" class="select"
				title="Select schema">db_backupoperator</a> </li>
		<li class="filter-schema-name"><a
				href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;ns=db_datareader" class="select"
				title="Select schema">db_datareader</a> </li>
		<li class="filter-schema-name"><a
				href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;ns=db_datawriter" class="select"
				title="Select schema">db_datawriter</a> </li>
		<li class="filter-schema-name"><a
				href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;ns=db_denydatareader" class="select"
				title="Select schema">db_denydatareader</a> </li>
		<li class="filter-schema-name"><a
				href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;ns=db_denydatawriter" class="select"
				title="Select schema">db_denydatawriter</a> </li>
	</ul>
</div>
```



# in adminer main content (right) is like this provided html
```html
<div id="content">
<p id="breadcrumb"><a href="admindb.php?mssql=localhost%5CSQLEXPRESS">MS SQL (beta)</a> » <a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa" accesskey="1" title="Alt+Shift+1">localhost\SQLEXPRESS</a> » <a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;db=EZChildTrack_CustomerDB&amp;ns=">EZChildTrack_CustomerDB</a> » Schema: dbo
</p><h2>Schema: dbo</h2>
<div id="ajaxstatus" class="jsonly hidden hidden"></div>
<h3 id="tables-views">Tables and views</h3>
<form action="" method="post">
<fieldset><legend>Total Rows <span id="selected2">(28)</span></legend><div><input type="search" id="filter-table-input" placeholder="Search rows..." value=""><script nonce="">mixin(qs('#filter-table-input'), {onkeyup: debounce(filterTables)}); qs('#filter-table-input').value = '';</script>
<span id="filter-table-count"></span></div></fieldset>
<div class="scrollable">
<table id="filter-table-list" cellspacing="0" class="nowrap checkable">
<script nonce="">mixin(qsl('table'), {onclick: tableClick, ondblclick: partialArg(tableClick, true)});</script>
<thead><tr class="wrap"><td><input id="check-all" type="checkbox" class="jsonly"><script nonce="">qs('#check-all').onclick = partial(formCheck, /^(tables|views)\[/);</script></td><th>Table</th><th>Show structure</th><td>Engine</td><td>Collation</td><td>Comment</td></tr></thead>
<tbody><tr class="filter-table-row"><td><input type="checkbox" name="tables[]" value="tblJob" aria-labelledby="Table-tblJob"></td><th><a class="filter-tablename" href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;db=EZChildTrack_CustomerDB&amp;ns=dbo&amp;select=tblJob" title="Select Data" id="Table-tblJob">tblJob</a></th><th><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;db=EZChildTrack_CustomerDB&amp;ns=dbo&amp;table=tblJob" title="Show structure">Table structure</a></th><td id="Engine-tblJob">USER_TABLE</td><td id="Collation-tblJob"></td><td id="Comment-tblJob">Stores the email jobs that needs to be executed</td></tr><tr class="filter-table-row"><td><input type="checkbox" name="views[]" value="vuActiveCustomerList" aria-labelledby="Table-vuActiveCustomerList"></td><th><a class="filter-tablename" href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;db=EZChildTrack_CustomerDB&amp;ns=dbo&amp;select=vuActiveCustomerList" title="Select Data" id="Table-vuActiveCustomerList">vuActiveCustomerList</a></th><th><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;db=EZChildTrack_CustomerDB&amp;ns=dbo&amp;view=vuActiveCustomerList" title="Show structure">View structure</a></th><td colspan="2"><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;db=EZChildTrack_CustomerDB&amp;ns=dbo&amp;view=vuActiveCustomerList" title="Alter view">View</a></td><td id="Comment-vuActiveCustomerList"></td></tr><tr><td></td><th>29 in total</th><td></td><td>SQL_Latin1_General_CP1_CI_AS</td></tr></tbody></table>
</div>

</form>
<script nonce="">tableCheck();</script>
<h3 id="routines">Routines</h3>
<table cellspacing="0">
<thead><tr><th>Routine Name</th><td>Execute Routine</td><td>Alter Routine</td><td>Created At</td><td>Modified At</td><td></td></tr></thead>
<tbody><tr><th><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;db=EZChildTrack_CustomerDB&amp;ns=dbo&amp;call=dbo.API_InsertErrorLog&amp;name=API_InsertErrorLog">dbo.API_InsertErrorLog</a></th><td><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;db=EZChildTrack_CustomerDB&amp;ns=dbo&amp;call=dbo.API_InsertErrorLog&amp;name=API_InsertErrorLog">Execute</a></td><td><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;db=EZChildTrack_CustomerDB&amp;ns=dbo&amp;procedure=dbo.API_InsertErrorLog&amp;name=API_InsertErrorLog">Alter</a></td><td class="customgray">2023-12-06 10:51:09</td><td class="customgray">2023-12-06 10:51:09</td></tr><tr class="odd"><th><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;db=EZChildTrack_CustomerDB&amp;ns=dbo&amp;call=dbo.AppError_InsertErrorLog&amp;name=AppError_InsertErrorLog">dbo.AppError_InsertErrorLog</a></th><td><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;db=EZChildTrack_CustomerDB&amp;ns=dbo&amp;call=dbo.AppError_InsertErrorLog&amp;name=AppError_InsertErrorLog">Execute</a></td><td><a href="admindb.php?mssql=localhost%5CSQLEXPRESS&amp;username=sa&amp;db=EZChildTrack_CustomerDB&amp;ns=dbo&amp;procedure=dbo.AppError_InsertErrorLog&amp;name=AppError_InsertErrorLog">Alter</a></td><td class="customgray">2023-06-28 11:19:08</td><td class="customgray">2023-12-06 10:51:09</td></tr></tbody></table>
</div>
```

now u know the sidebar & main panel , so make all the changes & make sure ui design looks same like vscode as close as possible 


still design is not looking professional vscode UI.. also instead of showing table & views & after that routines u can add 3 tabs there

table & views, stored procedures,  functions

so when I click on these tabs it shows the inline search filter & then the good looking table


also if I click on any table name it show show the table data with pagination similar to adminer.php