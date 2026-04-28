<div align="center">

# 🧩 RoomieManager Frontend

*The cozy interface. The part you actually see.*

[![React](https://img.shields.io/badge/React-18-3F7D4E?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3F7D4E?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-3F7D4E?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-CSS-6B8E5A?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Live](https://img.shields.io/badge/live-roomiemanager.site-A8C09A)](https://roomiemanager.site)

</div>

---

> **What this is.** A React 18 + TypeScript single-page app built with Vite 6, styled with Tailwind, navigated with React Router, and iconified with lucide-react. It talks to the RoomieManager API, stores the returned session locally, and attaches bearer tokens through the shared API client.

<div align="center">
  <img src="../docs/assets/roomiemanager-web-login.png" alt="RoomieManager web sign-in screen" width="720" />
</div>

— · — · — · —

## 🧱 Stack

| Concern | Tool |
| --- | --- |
| UI runtime | **React 18** |
| Language | **TypeScript** |
| Build and dev server | **Vite 6** |
| Styling | **Tailwind CSS** |
| Routing | **React Router** |
| Icons | **lucide-react** |
| API client | Wrapped `fetch` client in `src/lib/api.ts` |
| Package manager | **pnpm 9** |

— · — · — · —

## 🚀 Run It Locally

```bash
cd frontend
pnpm install
cp .env.example .env
pnpm dev
```

Web: `http://localhost:5173`

— · — · — · —

## 🛠 Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the Vite dev server with HMR |
| `pnpm build` | Type-check and produce the production bundle |
| `pnpm preview` | Serve the production build locally |

— · — · — · —

## 🎨 Design Language

The product leans into a **warm, green, homey** palette: cream surfaces, sage accents, rounded cards, and quiet type. The UI is meant to feel like a shared household workspace, not an enterprise admin panel.

— · — · — · —

## 🌐 Where It Points

| Environment | API base |
| --- | --- |
| Local dev proxy | `/api/v1` |
| Local backend | `http://localhost:3000/api/v1` |
| Production | `https://api.roomiemanager.site/api/v1` |

The app reads `VITE_API_BASE_URL` from [.env.example](.env.example). Leaving it blank uses the Vite `/api/v1` proxy; setting it points the app directly at the chosen API base.

— · — · — · —

## 🗺 Repository Orientation

```text
frontend/
├── src/
│   ├── pages/        Route-level screens for auth, groups, dashboard, chores, finance, members, contracts
│   ├── components/   Layout, route protection, and chore UI components
│   ├── contexts/     Auth context and session handling
│   ├── lib/          API client, callback helpers, identity helpers
│   ├── types/        Shared frontend API types
│   └── index.css     Tailwind entry and global component classes
├── generated/        Generated backend OpenAPI TypeScript types
└── vercel.json       Rewrites and production routing
```

For the full system view, see [../ARCHITECTURE.md](../ARCHITECTURE.md).
