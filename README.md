# UniCampus Store
Setup: `npm install` (root), copy `.env.example` to `.env`, then `npm run seed -w server`, `npm run dev -w server`, `npm run dev -w client`.
Env vars: see `.env.example`. Cookies are Secure only when NODE_ENV=production.
Deploy: build with `npm run build -w client`; serve client/dist and proxy /api to the server (same origin) behind HTTPS, then add a CNAME/A record for unicampusstore.levelupautomations.in to your host and set CLIENT_URL to that URL.
