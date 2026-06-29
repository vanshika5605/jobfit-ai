const messagesEl = document.getElementById('messages');
const form = document.getElementById('chat-form');
const input = document.getElementById('message-input');
const clearBtn = document.getElementById('clear-btn');
const voiceBtn = document.getElementById('voice-btn');

const sessionId = getOrCreateSessionId();

loadHistory();

form.addEventListener('submit', async (event) => {
	event.preventDefault();

	const message = input.value.trim();

	if (!message) return;

	input.value = '';

	addMessage('user', message);

	const loadingEl = addMessage('assistant', 'Thinking...');

	try {
		const response = await fetch('/api/chat', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				sessionId,
				message,
			}),
		});

		const data = await response.json();

		if (!response.ok) {
			throw new Error(data.error || 'Request failed.');
		}

		loadingEl.textContent = data.reply;
	} catch (error) {
		loadingEl.textContent = `Error: ${error.message}`;
	}
});

clearBtn.addEventListener('click', async () => {
	await fetch('/api/clear', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			sessionId,
		}),
	});

	messagesEl.innerHTML = '';
	addMessage('system', 'Session cleared.');
});

voiceBtn.addEventListener('click', () => {
	const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

	if (!SpeechRecognition) {
		addMessage('system', 'Voice input is not supported in this browser.');
		return;
	}

	const recognition = new SpeechRecognition();
	recognition.lang = 'en-US';
	recognition.interimResults = false;
	recognition.maxAlternatives = 1;

	recognition.start();

	recognition.onresult = (event) => {
		const transcript = event.results[0][0].transcript;
		input.value = input.value ? `${input.value} ${transcript}` : transcript;
	};

	recognition.onerror = () => {
		addMessage('system', 'Could not capture voice input.');
	};
});

async function loadHistory() {
	try {
		const response = await fetch(`/api/history?sessionId=${encodeURIComponent(sessionId)}`);
		const data = await response.json();

		if (!data.messages || data.messages.length === 0) {
			addMessage(
				'assistant',
				'Hi, I’m JobFit AI. Paste a job description or application question, and I’ll help you tailor a strong response.',
			);
			return;
		}

		data.messages.forEach((message) => {
			addMessage(message.role, message.content);
		});
	} catch {
		addMessage('system', 'Could not load previous session.');
	}
}

function addMessage(role, content) {
	const el = document.createElement('div');
	el.className = `message ${role}`;
	el.textContent = content;
	messagesEl.appendChild(el);
	messagesEl.scrollTop = messagesEl.scrollHeight;
	return el;
}

function getOrCreateSessionId() {
	const key = 'jobfit-session-id';
	let id = localStorage.getItem(key);

	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem(key, id);
	}

	return id;
}
