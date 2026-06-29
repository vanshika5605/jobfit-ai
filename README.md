JobFit AI

JobFit AI is an AI-powered job application assistant built on Cloudflare. It helps users paste a job description, ask application-related questions, generate tailored responses, and maintain session memory across chat turns.

The app demonstrates a Cloudflare-native architecture using Workers AI, a Cloudflare Worker, Durable Objects, and a static chat frontend.

Features

- Chat interface for job descriptions and application questions
- Workers AI integration using Llama 3.3
- Durable Object memory for per-session chat history
- Cloudflare Worker as the coordination layer
- Static frontend served through Cloudflare Workers assets
- Memory panel to view stored conversation history
- Clear memory action for resetting the session

Project Use Case

JobFit AI is designed for candidates applying to jobs. A user can paste a job description and ask questions such as:

Help me answer why I am interested in this role.
Summarize the key skills required for this job.
Rewrite my response to sound more technical and concise.

The assistant uses the current conversation memory to generate more contextual and useful responses over time.

Architecture

Browser Chat UI
|
v
Cloudflare Worker
|
+--> Durable Object
| Stores per-session memory
| Stores user and assistant messages
|
+--> Workers AI
| Runs Llama 3.3
| Generates the assistant response
|
+--> Static Assets
Serves public/index.html

Cloudflare Components

1. Cloudflare Worker

The Worker is the main coordination layer. It exposes API routes, receives chat messages from the frontend, reads and writes memory through a Durable Object, calls Workers AI, and serves the static frontend.

Main routes:

POST /api/chat
GET /api/history?sessionId=...
POST /api/clear
GET /api/health

2. Workers AI

Workers AI provides the LLM used by the application. JobFit AI uses the following model:

@cf/meta/llama-3.3-70b-instruct-fp8-fast

The Worker calls the model through the env.AI binding:

const aiResult = await env.AI.run(MODEL, {
messages: aiMessages,
max_tokens: 900
});

3. Durable Objects

Durable Objects are used for memory and state. Each browser session gets a session ID stored in localStorage. That session ID is used to route messages to a specific Durable Object instance.

The Durable Object stores:

- User messages
- Assistant responses
- Timestamps
- Recent conversation history

This allows JobFit AI to remember the previous messages in the same session.

4. Static Assets

The frontend lives in the public directory and is served by the Worker through the ASSETS binding.

public/index.html

The frontend lets users:

- Paste a job description
- Send a chat message
- View the AI response
- Show session memory
- Clear session memory

Project Structure

jobfit-ai/
├── package.json
├── wrangler.jsonc
├── src/
│ └── index.js
└── public/
└── index.html

Setup

1. Install dependencies

npm install

2. Configure Wrangler

The wrangler.jsonc file should include Workers AI, Durable Objects, migrations, and static assets.

{
"$schema": "node_modules/wrangler/config-schema.json",
"name": "jobfit-ai",
"main": "src/index.js",
"compatibility_date": "2026-06-29",
"observability": {
"enabled": true
},
"upload_source_maps": true,
"compatibility_flags": [
"nodejs_compat"
],
"ai": {
"binding": "AI"
},
"durable_objects": {
"bindings": [
{
"name": "CHAT_SESSIONS",
"class_name": "ChatSession"
}
]
},
"migrations": [
{
"tag": "v1",
"new_sqlite_classes": [
"ChatSession"
]
}
],
"assets": {
"directory": "./public",
"binding": "ASSETS"
}
}

3. Run locally

npm run dev

Then open:

http://localhost:8787

4. Deploy

npm run deploy

How It Works

Chat Flow

1. The user enters a message in the chat UI.
2. The frontend sends a request to:

POST /api/chat

3. The Worker stores the user message in a Durable Object.
4. The Worker retrieves recent session history from the Durable Object.
5. The Worker builds a prompt for JobFit AI.
6. The Worker calls Workers AI using Llama 3.3.
7. The assistant response is saved back into the Durable Object.
8. The response is returned to the frontend and displayed in the chat.

Example Request

{
"sessionId": "abc-123",
"message": "Here is a job description. Help me answer why I am interested in this role."
}

Example Response

{
"sessionId": "abc-123",
"reply": "This role is exciting because it combines product-focused engineering with AI-powered workflows..."
}

Demo Flow

Use the following flow to demo the project:

Step 1: Open the app

Open the deployed or local URL.

http://localhost:8787

Step 2: Paste a job description

Paste a job description into the chat box and ask:

Summarize this role and identify the top skills required.

Step 3: Generate a tailored answer

Ask:

Help me answer: Why are you interested in this role?

Step 4: Show memory

Click the Show Memory button. The memory panel should show the previous user and assistant messages stored in the Durable Object.

Step 5: Continue the conversation

Ask:

Make the answer shorter and more technical.

The assistant should use the earlier job description and previous response as context.

Step 6: Clear memory

Click Clear Memory. The Durable Object session memory is cleared for the current browser session.

Assignment Requirements Mapping

Requirement Implementation
LLM Workers AI with Llama 3.3
Workflow or coordination Cloudflare Worker coordinates frontend, memory, and model calls
User input through chat or voice Chat UI in public/index.html
Memory or state Durable Object stores per-session chat history
Frontend Static HTML served through Workers assets
API Worker exposes /api/chat, /api/history, /api/clear, and /api/health

Key Files

src/index.js

Contains:

- Worker request routing
- /api/chat implementation
- Workers AI call
- Durable Object memory logic
- Static frontend serving

public/index.html

Contains:

- Chat interface
- Message input
- AI response display
- Memory panel
- Clear memory button

wrangler.jsonc

Contains:

- Workers AI binding
- Durable Object binding
- Durable Object migration
- Static assets binding

Future Improvements

Possible extensions:

- Add resume upload using R2
- Add semantic memory using Vectorize
- Add voice input using browser speech recognition
- Add streaming responses
- Add authentication
- Add saved job applications
- Add structured outputs for resume bullets, recruiter DMs, and interview prep

Summary

JobFit AI is a lightweight but complete AI-powered Cloudflare application. It uses a Worker as the coordination layer, Workers AI with Llama 3.3 for response generation, Durable Objects for memory, and a static chat UI for user interaction.

Prompt history: https://chatgpt.com/share/6a42ca15-9718-83ea-bfc8-ba271f716f4e
