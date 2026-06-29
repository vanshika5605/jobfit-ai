const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		try {
			if (url.pathname === '/api/chat' && request.method === 'POST') {
				return handleChat(request, env);
			}

			if (url.pathname === '/api/history' && request.method === 'GET') {
				return handleHistory(request, env);
			}

			if (url.pathname === '/api/clear' && request.method === 'POST') {
				return handleClear(request, env);
			}

			if (url.pathname === '/api/health' && request.method === 'GET') {
				return json({
					ok: true,
					app: 'JobFit AI',
				});
			}

			// Serve static frontend from ./public through the ASSETS binding.
			return env.ASSETS.fetch(request);
		} catch (error) {
			console.error('Worker error:', error);

			return json(
				{
					error: 'Internal server error',
					message: error.message,
				},
				500,
			);
		}
	},
};

async function handleChat(request, env) {
	const body = await request.json().catch(() => null);

	if (!body) {
		return json({ error: 'Invalid JSON body' }, 400);
	}

	const sessionId = body.sessionId || 'default';
	const userMessage = body.message;

	if (!userMessage || typeof userMessage !== 'string') {
		return json({ error: 'message is required' }, 400);
	}

	const session = getSessionObject(env, sessionId);

	// Save the user's message first.
	await session.fetch('https://jobfit-session/add-message', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			role: 'user',
			content: userMessage,
		}),
	});

	// Read session memory.
	const historyResponse = await session.fetch('https://jobfit-session/history');
	const historyData = await historyResponse.json();
	const messages = historyData.messages || [];

	const aiMessages = buildAIMessages(messages);

	const aiResult = await env.AI.run(MODEL, {
		messages: aiMessages,
		max_tokens: 900,
	});

	const assistantReply = extractAIText(aiResult);

	// Save assistant reply into Durable Object memory.
	await session.fetch('https://jobfit-session/add-message', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			role: 'assistant',
			content: assistantReply,
		}),
	});

	return json({
		sessionId,
		reply: assistantReply,
	});
}

async function handleHistory(request, env) {
	const url = new URL(request.url);
	const sessionId = url.searchParams.get('sessionId') || 'default';

	const session = getSessionObject(env, sessionId);

	const response = await session.fetch('https://jobfit-session/history');
	const data = await response.json();

	return json(data);
}

async function handleClear(request, env) {
	const body = await request.json().catch(() => ({}));
	const sessionId = body.sessionId || 'default';

	const session = getSessionObject(env, sessionId);

	await session.fetch('https://jobfit-session/clear', {
		method: 'POST',
	});

	return json({
		ok: true,
		message: 'Session cleared',
	});
}

function getSessionObject(env, sessionId) {
	const durableObjectId = env.CHAT_SESSIONS.idFromName(sessionId);
	return env.CHAT_SESSIONS.get(durableObjectId);
}

function buildAIMessages(messages) {
	const systemPrompt = `
You are JobFit AI, an AI-powered job application coach.

Your goal:
Help candidates tailor job applications, recruiter messages, interview answers, and resume bullets.

You can help with:
- Understanding job descriptions
- Extracting key role requirements
- Matching user experience to a role
- Drafting application answers
- Improving recruiter DMs and emails
- Preparing concise interview responses
- Rewriting resume bullets with measurable impact

Rules:
- Do not invent experience.
- Use only details the user has provided in the conversation.
- If important information is missing, ask one short follow-up question.
- Prefer concise, practical, polished responses.
- For application answers, sound confident but not exaggerated.
- When useful, include a stronger revised version and a brief reason why it works.
`;

	const recentMessages = messages
		.slice(-16)
		.filter((message) => {
			return (
				message && typeof message.role === 'string' && typeof message.content === 'string' && ['user', 'assistant'].includes(message.role)
			);
		})
		.map((message) => ({
			role: message.role,
			content: message.content,
		}));

	return [
		{
			role: 'system',
			content: systemPrompt,
		},
		...recentMessages,
	];
}

function extractAIText(aiResult) {
	if (!aiResult) {
		return 'I could not generate a response.';
	}

	if (typeof aiResult.response === 'string') {
		return aiResult.response;
	}

	if (typeof aiResult.result?.response === 'string') {
		return aiResult.result.response;
	}

	if (typeof aiResult.output_text === 'string') {
		return aiResult.output_text;
	}

	if (Array.isArray(aiResult.result?.content)) {
		return aiResult.result.content
			.map((item) => item.text || '')
			.join('')
			.trim();
	}

	return 'I could not generate a response.';
}

function json(data, status = 200) {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
}

export class ChatSession {
	constructor(state, env) {
		this.state = state;
		this.env = env;
	}

	async fetch(request) {
		const url = new URL(request.url);

		if (request.method === 'OPTIONS') {
			return json({ ok: true });
		}

		if (url.pathname === '/add-message' && request.method === 'POST') {
			return this.addMessage(request);
		}

		if (url.pathname === '/history' && request.method === 'GET') {
			return this.getHistory();
		}

		if (url.pathname === '/clear' && request.method === 'POST') {
			return this.clearHistory();
		}

		return json({ error: 'Durable Object route not found' }, 404);
	}

	async addMessage(request) {
		const body = await request.json().catch(() => null);

		if (!body) {
			return json({ error: 'Invalid JSON body' }, 400);
		}

		const role = body.role;
		const content = body.content;

		if (!['user', 'assistant'].includes(role)) {
			return json({ error: 'Invalid message role' }, 400);
		}

		if (!content || typeof content !== 'string') {
			return json({ error: 'Message content is required' }, 400);
		}

		const messages = await this.getMessages();

		messages.push({
			role,
			content,
			createdAt: new Date().toISOString(),
		});

		// Keep memory bounded so the Durable Object does not grow forever.
		const trimmedMessages = messages.slice(-50);

		await this.state.storage.put('messages', trimmedMessages);

		return json({
			ok: true,
			messageCount: trimmedMessages.length,
		});
	}

	async getHistory() {
		const messages = await this.getMessages();

		return json({
			messages,
		});
	}

	async clearHistory() {
		await this.state.storage.delete('messages');

		return json({
			ok: true,
		});
	}

	async getMessages() {
		return (await this.state.storage.get('messages')) || [];
	}
}
