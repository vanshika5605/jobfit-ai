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

		if (url.pathname === '/clear' && request.method === 'POST') {
			await this.state.storage.delete('messages');
			return Response.json({ ok: true });
		}

		return new Response('Not found', { status: 404 });
	}
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		if (url.pathname === '/api/chat' && request.method === 'POST') {
			return handleChat(request, env);
		}

		if (url.pathname === '/api/history' && request.method === 'GET') {
			return getHistory(request, env);
		}

		if (url.pathname === '/api/clear' && request.method === 'POST') {
			return clearHistory(request, env);
		}

		return env.ASSETS.fetch(request);
	},
};

async function handleChat(request, env) {
	try {
		const body = await request.json();
		const message = body.message;
		const sessionId = body.sessionId || 'default-session';

		if (!message || typeof message !== 'string') {
			return Response.json({ error: 'Message is required.' }, { status: 400 });
		}

		const memoryObject = getMemoryObject(env, sessionId);

		const memoryResponse = await memoryObject.fetch('https://memory/get');
		const previousMessages = await memoryResponse.json();

		const previousContext = previousMessages
			.map((item, index) => {
				return `Exchange ${index + 1}
User: ${item.user}
Assistant: ${item.assistant}`;
			})
			.join('\n\n');

		const prompt = buildPrompt(message, previousContext);

		const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
			messages: [
				{
					role: 'system',
					content:
						"You are JobFit AI, a concise technical recruiter and resume coach. Give specific, practical, honest advice. Do not invent experience. When rewriting bullets, preserve the user's real background.",
				},
				{
					role: 'user',
					content: prompt,
				},
			],
			max_tokens: 1200,
		});

		const answer = aiResponse.response || aiResponse.result || JSON.stringify(aiResponse, null, 2);

		await memoryObject.fetch('https://memory/add', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				user: message,
				assistant: answer,
			}),
		});

		return Response.json({
			answer,
		});
	} catch (error) {
		return Response.json(
			{
				error: 'Something went wrong while generating the response.',
				details: error.message,
			},
			{ status: 500 },
		);
	}
}

async function getHistory(request, env) {
	const url = new URL(request.url);
	const sessionId = url.searchParams.get('sessionId') || 'default-session';
	const memoryObject = getMemoryObject(env, sessionId);

	const memoryResponse = await memoryObject.fetch('https://memory/get');
	const history = await memoryResponse.json();

	return Response.json({ history });
}

async function clearHistory(request, env) {
	const body = await request.json().catch(() => ({}));
	const sessionId = body.sessionId || 'default-session';
	const memoryObject = getMemoryObject(env, sessionId);

	await memoryObject.fetch('https://memory/clear', {
		method: 'POST',
	});

	return Response.json({ ok: true });
}

function getMemoryObject(env, sessionId) {
	const id = env.JOB_MEMORY.idFromName(sessionId);
	return env.JOB_MEMORY.get(id);
}

function buildPrompt(message, previousContext) {
	return `
You are helping a software engineer tailor job applications.

Previous conversation memory:
${previousContext || 'No previous memory yet.'}

Current user input:
${message}

Analyze the input and respond in this structure:

## Fit Summary
Give a short, honest summary of fit.

## Strong Matches
List the strongest matching skills, projects, or experiences.

## Missing or Weak Areas
List missing keywords or experience gaps.

## Resume Bullet Suggestions
Rewrite 2-4 resume bullets. Make them impact-focused, technical, and truthful.

## Outreach Message
Write a short recruiter or hiring manager message.

## Next Action
Give one concrete next step.
`;
}
