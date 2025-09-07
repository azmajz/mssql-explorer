const { randomUUID } = require('crypto');

class GlobalState {
	constructor(context) {
		this.context = context;
		this.keyConnections = 'mssqlExplorer.connections';
	}

	async getConnections() {
		return this.context.globalState.get(this.keyConnections) || [];
	}

	async getConnectionById(id) {
		const all = await this.getConnections();
		return all.find(c => c.id === id);
	}

	async addConnection({ name, server, database, user, password, options }) {
		const all = await this.getConnections();
		const id = randomUUID();
		all.push({ id, name, server, database, user, password, options });
		await this.context.globalState.update(this.keyConnections, all);
		return id;
	}

	async updateConnection(updated) {
		const all = await this.getConnections();
		const idx = all.findIndex(c => c.id === updated.id);
		if (idx >= 0) {
			all[idx] = updated;
			await this.context.globalState.update(this.keyConnections, all);
		}
	}

	async deleteConnection(id) {
		const all = await this.getConnections();
		const next = all.filter(c => c.id !== id);
		await this.context.globalState.update(this.keyConnections, next);
	}
}

module.exports = { GlobalState };


