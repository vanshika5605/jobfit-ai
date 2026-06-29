# JobFit AI

JobFit AI is an AI-powered application built on Cloudflare. It helps job seekers analyze job descriptions, identify fit gaps, rewrite resume bullets, and generate recruiter outreach messages.

## Features

- Chat-based user input
- LLM-powered job description analysis
- Resume bullet tailoring
- Recruiter outreach generation
- Persistent session memory
- Conversation history display

## Cloudflare Components Used

- Cloudflare Workers for the API and app coordination
- Workers AI with Llama 3.3 70B Instruct for LLM generation
- Durable Objects for memory and state
- Static assets served through the Worker

## Architecture

Browser UI sends a message to `/api/chat`.

The Worker:

1. Reads previous memory from a Durable Object
2. Builds a grounded prompt
3. Calls Workers AI
4. Stores the new exchange back into memory
5. Returns the answer to the UI

## Model

The app uses:

`@cf/meta/llama-3.3-70b-instruct-fp8-fast`

## How to run

```bash
npm install
npx wrangler dev
```
