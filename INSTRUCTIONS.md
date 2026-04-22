# Random Video Chat — Setup Instructions

A self-contained random video chat app (like Omegle). Two users hit "Start", get paired, video-chat peer-to-peer, and hit "Skip" to find someone new.

---

## 1. What files to send

Send the **entire `omegle-clone/` folder** — but **exclude** `node_modules/` (it's huge and gets regenerated automatically).

You should send:

```
omegle-clone/
├── package.json
├── package-lock.json
├── server.js
├── INSTRUCTIONS.md    ← this file
└── public/
    ├── index.html
    ├── app.js
    └── style.css
```

Easiest way: zip the folder but delete `node_modules/` first, or use:
```bash
tar --exclude='node_modules' -czf omegle-clone.tar.gz omegle-clone/
```

---

## 2. What your friend needs before starting

- **Node.js 18+** installed ([nodejs.org](https://nodejs.org))
- A terminal / command prompt
- A hosting option for Node apps (see section 4)

---

## 3. Running it locally (first test)

```bash
cd omegle-clone
npm install
npm start
```

Then open **http://localhost:3000** in **two** browser tabs (or two different browsers). Click Start in both — they'll auto-pair.

> On localhost, browsers allow camera access without HTTPS. **In production, HTTPS is required** — WebRTC won't work over plain HTTP.

---

## 4. Deploying to a real host

This app has a **Node.js backend** (it's not just static HTML), so it can't go on plain GitHub Pages, Netlify, or a typical shared webhost. Pick one of these:

### Option A — Easiest: Render.com (free tier works)
1. Push the `omegle-clone` folder to a GitHub repo.
2. On [render.com](https://render.com), click **New → Web Service** → connect the repo.
3. Set:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Deploy. Render gives you an HTTPS URL like `https://your-app.onrender.com`.

### Option B — Railway / Fly.io / Heroku
Same flow: push the code, connect the repo, the platform auto-detects Node and runs `npm start`. The `PORT` env variable is respected by the server.

### Option C — His own VPS (DigitalOcean, AWS, etc.)
1. Install Node.js on the server.
2. Copy the folder, run `npm install`, then `npm start`.
3. Put Nginx or Caddy in front as a reverse proxy with a real SSL certificate (Let's Encrypt). **HTTPS is mandatory for camera access.**
4. Use `pm2` or `systemd` to keep the process alive after logout.

---

## 5. Embedding it on his existing website

Once deployed (say at `https://chat.hissite.com`), there are two ways to put it on his main site:

### Option 1 — Subdomain link (simplest)
Just link to it: `<a href="https://chat.hissite.com">Start video chat</a>`

### Option 2 — iframe embed
Drop this into any page on his site:
```html
<iframe
  src="https://chat.hissite.com"
  width="100%"
  height="700"
  allow="camera; microphone"
  style="border: none;">
</iframe>
```

The `allow="camera; microphone"` attribute is **required** — without it, the iframe can't access the user's devices.

---

## 6. Configuration & customization

| Thing to change | Where |
|---|---|
| Port | `PORT` environment variable (default 3000) |
| Page title / heading | [`public/index.html`](public/index.html) |
| Colors, layout | [`public/style.css`](public/style.css) |
| STUN/TURN servers | `ICE_SERVERS` in [`public/app.js`](public/app.js) |

### About STUN/TURN servers
The app uses Google's free public STUN servers by default. STUN works for ~80% of users. For the remaining 20% (behind strict NATs / corporate firewalls), you need a **TURN server** which relays video through a middleman.

If connections fail for some users, sign up for a free TURN service like [Metered.ca](https://www.metered.ca/tools/openrelay/) and add their credentials to the `ICE_SERVERS` config in `app.js`.

---

## 7. How it works (quick architecture)

- The Node server (`server.js`) is **only a matchmaker + signaling relay**. Video never passes through it.
- When two users press Start, the server pairs them and tells one to be "offerer" and one to be "answerer".
- They exchange WebRTC offer/answer/ICE through the server (small text messages).
- After that, video streams **directly peer-to-peer** between the two browsers.
- Skip = server disconnects them, both re-enter the waiting queue.

Bandwidth on the server is minimal (no video passes through). CPU is minimal too. A cheap $5/month VPS will handle hundreds of concurrent pairs.

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| "Could not access camera" | Site must be HTTPS (or localhost). Check browser permissions. |
| Users never match | Both must press Start. Check server logs — should see "connection" events. |
| Video connects then drops immediately | Likely a NAT issue — add a TURN server (see section 6). |
| Works on same network, fails across networks | Same NAT issue — needs TURN. |
| `EADDRINUSE` on startup | Port 3000 is already used. Set `PORT=4000` env var. |
