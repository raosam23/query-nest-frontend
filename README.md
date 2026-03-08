# QueryNest Frontend 🔍

The NextJS frontend for QueryNest — a multi-agent AI research assistant.

> ⚠️ **Work in Progress** — This project is actively being developed.

## Tech Stack

- **NextJS 16** — React framework with App Router
- **TypeScript** — Type safety
- **Tailwind CSS** — Styling
- **shadcn/ui** — Component library
- **Axios** — HTTP client
- **react-markdown** — Markdown rendering
- **Sonner** — Toast notifications

## Pages

| Route            | Description                       | Auth Required |
| ---------------- | --------------------------------- | ------------- |
| `/`              | Redirects based on auth status    | No            |
| `/login`         | Login page                        | No            |
| `/register`      | Register page                     | No            |
| `/dashboard`     | Research session history          | Yes           |
| `/research/[id]` | Live research progress and report | Yes           |

## Features

- JWT authentication with cookie-based token storage
- Route protection via NextJS proxy middleware
- Live WebSocket streaming of agent progress
- Final report rendered as markdown
- Sources displayed with title, URL and snippet
- Toast notifications for errors and success messages
- Loading spinners for async operations
- Dark theme throughout

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment

Make sure the QueryNest backend is running at `http://localhost:8000` before starting the frontend.
