<div align="center">

# 📖 RoomieManager Docs

*Notes, screenshots, and the long-form story behind the product.*

</div>

---

This folder is the slower lane: the things that do not belong in a code comment or a top-level hero, but still matter when you are trying to understand why the system feels the way it does.

— · — · — · —

## 🗂 What's In Here

| Path | What it is |
| --- | --- |
| [assets/roomiemanager-showcase.svg](assets/roomiemanager-showcase.svg) | The web hero illustration used in the root README. |
| [assets/roomiemanager-web-login.png](assets/roomiemanager-web-login.png) | Real screenshot of the live web app sign-in screen. |
| [assets/](assets/) | Supporting visuals used across the repo presentation. |

> 🌿 If you add a screenshot, prefer the live app at [roomiemanager.site](https://roomiemanager.site) over a local dev capture when possible. It keeps the public repo aligned with the deployed product.

— · — · — · —

## 🌐 Live Surfaces

| Surface | URL |
| --- | --- |
| Web app | [roomiemanager.site](https://roomiemanager.site) |
| API v1 | [api.roomiemanager.site/api/v1](https://api.roomiemanager.site/api/v1) |
| Swagger | [api.roomiemanager.site/api/docs](https://api.roomiemanager.site/api/docs) |

— · — · — · —

## 🧭 Reading Order

If this is your first time in the repo, read in this order:

1. [README.md](../README.md) - what the product is.
2. [ARCHITECTURE.md](../ARCHITECTURE.md) - how the system is shaped.
3. [backend/README.md](../backend/README.md) - the API.
4. [frontend/README.md](../frontend/README.md) - the interface.
5. This folder - assets and supporting reference.

— · — · — · —

## 🧪 Local Environments At A Glance

| Service | Default local URL |
| --- | --- |
| Web (Vite) | `http://localhost:5173` |
| API (NestJS) | `http://localhost:3000/api/v1` |
| Swagger (local) | `http://localhost:3000/api/docs` |

— · — · — · —

## 📷 Asset Guidelines

- **Format:** prefer SVG for illustration; PNG for actual UI captures.
- **Width:** target wide screenshots so README rendering stays crisp.
- **Naming:** `roomiemanager-<surface>-<scene>.{svg,png}`, for example `roomiemanager-web-dashboard.png`.
- **Theme:** keep the warm, green, homey palette consistent with the live product.
