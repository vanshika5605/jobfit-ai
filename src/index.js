/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export class JobMemory {
	constructor(state, env) {
		this.state = state;
		this.env = env;
	}

	async fetch(request) {
		const url = new URL(request.url);

		if (url.pathname === '/get') {
			const messages = await this.state.storage.get('messages');
			return Response.json(messages ?? []);
		}

		if (url.pathname === '/add' && request.method === 'POST') {
			const body = await request.json();
			const messages = (await this.state.storage.get('messages')) ?? [];

			messages.push({
				...body,
				timestamp: new Date().toISOString(),
			});

			await this.state.storage.put('messages', messages.slice(-10));
			return Response.json({ ok: true });
		}

		return new Response('Not found', { status: 404 });
	}
}
