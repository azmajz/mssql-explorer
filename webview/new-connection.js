const vscode = acquireVsCodeApi();

function render() {
	const root = document.getElementById('app');
	root.innerHTML = `
		<div class="container">
			<h1>MSSQL Database Connection</h1>
			<div class="description">Connect to your MSSQL database using msnodesqlv8 driver</div>
			<div class="form-section">
				<div class="section-title">Connection Details</div>
				<div class="form-group">
					<label for="server">Server</label>
					<input type="text" id="server" placeholder="localhost\\\\SQLEXPRESS" />
					<div class="help-text">Server name with instance (e.g., localhost\\\\SQLEXPRESS)</div>
				</div>
				<div class="form-group">
					<label for="database">Database</label>
					<input type="text" id="database" placeholder="master" />
				</div>
				<div class="form-group">
					<label for="username">Username</label>
					<input type="text" id="username" placeholder="sa" />
				</div>
				<div class="form-group">
					<label for="password">Password</label>
					<input type="password" id="password" placeholder="Enter password" />
				</div>
			</div>
			<div class="form-section">
				<div class="section-title">Options</div>
				<div class="checkbox-container">
					<input type="checkbox" id="trustedConnection" />
					<label for="trustedConnection" class="checkbox-label">Trusted Connection (Windows Authentication)</label>
				</div>
				<div class="checkbox-container">
					<input type="checkbox" id="trustServerCertificate" checked />
					<label for="trustServerCertificate" class="checkbox-label">Trust Server Certificate</label>
				</div>
			</div>
			<div class="button-container">
				<button class="btn-test" id="btnTest">Test Connection</button>
				<button class="btn-primary" id="btnConnect">Connect</button>
				<button class="btn-secondary" id="btnCancel">Cancel</button>
			</div>
			<div id="status" class="status"></div>
		</div>
	`;
	const byId = (id) => document.getElementById(id);
	const getData = () => ({
		server: byId('server').value,
		database: byId('database').value,
		user: byId('username').value,
		password: byId('password').value,
		options: {
			trustedConnection: byId('trustedConnection').checked,
			trustServerCertificate: byId('trustServerCertificate').checked
		}
	});
	byId('btnTest').addEventListener('click', () => {
		const s = byId('status');
		s.className = 'status'; s.style.display = 'block'; s.textContent = 'Testing connection...';
		vscode.postMessage({ command: 'test', connectionData: getData() });
	});
	byId('btnConnect').addEventListener('click', () => {
		const s = byId('status');
		s.className = 'status'; s.style.display = 'block'; s.textContent = 'Connecting...';
		const data = getData();
		data.name = `${data.server}${data.database ? ' - ' + data.database : ''}`;
		vscode.postMessage({ command: 'connect', connectionData: data });
	});
	byId('btnCancel').addEventListener('click', () => {
		vscode.postMessage({ command: 'cancel' });
	});
	window.addEventListener('message', (event) => {
		const message = event.data;
		const s = byId('status');
		if (message.command === 'testResult') {
			s.style.display = 'block';
			s.className = 'status ' + (message.success ? 'success' : 'error');
			s.textContent = message.success ? 'Connection test successful!' : 'Connection test failed: ' + message.error;
		} else if (message.command === 'connectResult') {
			s.style.display = 'block';
			s.className = 'status ' + (message.success ? 'success' : 'error');
			s.textContent = message.success ? 'Connected successfully!' : 'Connection failed: ' + message.error;
		}
	});
}

render();


