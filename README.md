# SoundWave 🎵

A scmp3-inspired music streaming and download web app built with **Next.js 15**, **Tailwind CSS**, **yt-dlp**, and **FFmpeg**.

## ✨ Features

- 🔍 **YouTube Search** with auto-suggest (debounced)
- 🎵 **Audio Streaming** via yt-dlp — no full download needed
- 📥 **Format Downloads**: MP3 128kbps, 256kbps, 320kbps, FLAC, WAV
- 🎮 **Bottom Fixed Player** — persists across pages (Zustand state)
- 💾 **Download Modal** with quality selector & album art
- ⚡ **Instant Caching** — same file served from temp cache for 1 hour

## 🚀 Quick Start

### 1. Install system dependencies

**Windows:**
- Download [yt-dlp.exe](https://github.com/yt-dlp/yt-dlp/releases) → Add to PATH
- Download [ffmpeg](https://ffmpeg.org/download.html) → Add to PATH

**Linux/Mac:**
```bash
pip install yt-dlp
# or: brew install yt-dlp
brew install ffmpeg
```

### 2. Configure YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable **YouTube Data API v3**
3. Create an API key
4. Edit `.env.local`:
   ```
   YOUTUBE_API_KEY=your_key_here
   ```

> **Without a key:** The app still works with mock placeholder data!

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── search/route.ts     ← YouTube API search
│   │   ├── stream/route.ts     ← yt-dlp streaming URL
│   │   └── download/route.ts   ← FFmpeg audio conversion
│   ├── page.tsx                ← Main homepage
│   ├── layout.tsx              ← Root layout + Player
│   └── globals.css             ← Custom styles
├── components/
│   ├── SearchBar.tsx           ← Auto-suggest search
│   ├── SongCard.tsx            ← Track list row
│   ├── AudioPlayer.tsx         ← Bottom persistent player
│   └── DownloadModal.tsx       ← Format selector popup
├── store/
│   └── playerStore.ts          ← Zustand global state
└── types/
    └── index.ts                ← TypeScript types
```

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Search | YouTube Data API v3 |
| Streaming | yt-dlp |
| Conversion | FFmpeg |

## 🌐 Deployment (VPS Recommended)

Audio conversion requires CPU/RAM — use a VPS:
- [DigitalOcean](https://digitalocean.com) Droplet ($6/mo)
- [Linode](https://linode.com)
- [Railway](https://railway.app)

Install yt-dlp and ffmpeg on the server, then deploy with `npm run build && npm start`.
