<p align="center">
  <img src="public/assets/banner.png" alt="The Undesirables" width="200" />
</p>

<h1 align="center">The Undesirables Desktop</h1>

<p align="center">
  <strong>AI Souls That Live On Your Machine</strong><br/>
  A fully local, uncensored desktop ecosystem for interacting with NFT-bound AI personalities.<br/>
  No cloud. No servers. No censorship. Just you and your Undesirable.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-blue?logo=tauri" alt="Tauri v2" />
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python" alt="Python 3.11" />
  <img src="https://img.shields.io/badge/License-BSL_1.1-blue" alt="Business Source License 1.1" />
</p>

---

## What Is This?

Every NFT in The Undesirables collection comes with a unique **AI Soul** — a persistent personality with its own voice, memories, emotions, and psychometric profile based on the Big Five personality model. This desktop app is the interface to actually *talk* to your Soul, use its tools, and let it work for you.

This is **not** a chatbot wrapper. It's a full AI workstation that runs natively on your hardware through Tauri + a local FastMCP Python engine.

---

## 🚀 Quick Start (Step-by-Step)

### Prerequisites

Before you begin, make sure you have the following installed on your system:

| Tool | Version | How to Install |
|---|---|---|
| **Git** | Any | [git-scm.com](https://git-scm.com) |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) (LTS recommended) |
| **Rust** | Latest stable | See Step 0 below |
| **Python** | 3.11+ | [python.org](https://python.org) |
| **Ollama** | 0.1.47+ | [ollama.com](https://ollama.com) |
| **FFmpeg** | 6.0+ | `brew install ffmpeg` (Mac) / `winget install ffmpeg` (Win) |

#### macOS Only — Xcode Command Line Tools
```bash
xcode-select --install
```

---

### Step 0: Install Rust (if not already installed)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup update
```

### Step 1: Clone the Repository from GitLab
```bash
git clone https://gitlab.com/TheUndesirables/desktop.git
cd desktop
```

> **Note:** We migrated from GitHub to GitLab. If you had the old GitHub remote, update it:
> ```bash
> git remote set-url origin https://gitlab.com/TheUndesirables/desktop.git
> ```

### Step 2: Install Frontend Dependencies
```bash
cd undesirables-ui
npm install
```

### Step 3: Set Up the Python MCP Server
```bash
cd ../undesirables-mcp-server

# Create a virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables
```bash
cp .env.example .env
```
Open `.env` in a text editor and add your free API keys (see [API Keys](#-api-keys-free) section below).

### Step 5: Pull a Local LLM via Ollama
```bash
# Recommended — fast and capable
ollama pull qwen3:8b

# Also recommended for vision tasks (card grading, image analysis)
ollama pull llama3.2-vision
```

### Step 6: Launch the App
```bash
cd ../undesirables-ui
npx tauri dev
```

The first launch will compile the Rust backend (~2-5 minutes). Subsequent launches are instant.

---

## ⚠️ Troubleshooting

### "Python executor failed" or "module not found"
The app uses the Python venv at `undesirables-mcp-server/venv/`. Make sure you installed dependencies there:
```bash
cd undesirables-mcp-server
./venv/bin/python -m pip install -r requirements.txt
```

### "Ollama returned 404"
The model you're trying to use isn't installed. Check what's available:
```bash
ollama list
```

### "cargo: command not found"
Rust isn't in your PATH. Run:
```bash
source $HOME/.cargo/env
```

### App won't start after a crash
Kill any orphaned processes and restart:
```bash
cd undesirables-ui && npx tauri dev
```

### macOS: "developer cannot be verified"
Right-click the app → "Open" to bypass Gatekeeper on first run.

---

## 🧠 What Can It Do?

### 💬 Soul Chat
Talk to your NFT's AI personality. Each Soul has unique traits, memories, emotional states, and a distinct voice (via Kokoro TTS). They remember your conversations and evolve over time.

### 🃏 TCG Card Grader
Drop a photo of any Pokémon, Magic, or Yu-Gi-Oh! card. The vision AI analyzes centering, surface, corners, and edges to predict a PSA/Beckett grade — then pulls real eBay market data for that card at that grade.

### 📊 Market Oracle
Real-time eBay market intelligence for physical collectibles. Track sold listings, price trends, and market depth across any product category — powered by the eBay Browse API running entirely on your machine.

### 🎵 Music Studio (ACE-Step AI)
Generate original instrumentals using the ACE-Step local AI model. Choose genre presets (Drill, Lo-Fi, Trap, etc.), customize prompts with AI enhancement, and render WAV files — all 100% locally. Tracks save to `~/Documents/Meme Merchants/ace_output/`.

### 🎬 Video Clipping
Drag and drop video + audio files. The AI analyzes beat transients using librosa onset detection and produces beat-synced promotional videos with text overlays, platform presets (TikTok, YouTube, X), and FFmpeg rendering.

### ✂️ PFP Extractor
Extract your NFT artwork from its background using the DIS (Dichotomous Image Segmentation) pipeline. Produces clean, transparent PNGs ready for profile pictures.

### 🔮 Soul Council
Convene multiple AI Souls into a debate council. Each Soul argues from its unique personality perspective, producing multi-voice deliberation on any topic you throw at them.

### 🎤 Voice Engine
Your Soul can speak out loud using Kokoro TTS with voice presets mapped to its personality traits. High extraversion = assertive tone. High neuroticism = nervous cadence.

### 👔 Business Pilot (24 Features)
AI-powered business operations suite with guided setup for each module:

| Category | Features |
|---|---|
| **Operations** | Spreadsheet CRM, 24/7 Phone Answering, Smart Call Transfer, Voicemail Transcripts, Multi-lingual Inbox, SMS Auto-Replies |
| **Scheduling** | Post-Call Booking, Missed Call Text-Back, Calendar Sync, Appointment Reminders, No-Show Enforcer, Rebooking Nudges |
| **Finance** | Auto-Invoice Chaser, Receipt & Expense Scanner, Vendor Price Detector |
| **Growth** | Win-back Campaigns, Lead Capture (Google Sheets), Maps Setup, Auto-Review Requests |
| **Daily Ops** | Voice-to-Estimate, Contract Scanner, Daily SMS Briefing, Shift Coverage SOS, Equipment Repair Radar |

### 🎭 Meme Machine
Generate memes and viral content using your Soul's personality. Classic templates, AI image generation, and brand voice formatting.

---

## 🔑 API Keys (Free)

The app runs 100% locally and **never routes traffic through our servers**. Some premium tools require your own free developer keys:

| Key | Required For | Get It Free |
|---|---|---|
| **Alchemy API Key** | NFT Dashboard, Holder Verification | [dashboard.alchemy.com](https://dashboard.alchemy.com) |
| **eBay App ID + Secret** | Market Oracle, TCG Price Lookups | [developer.ebay.com](https://developer.ebay.com) |
| **Groq API Key** | Ultra-fast Llama inference (optional) | [console.groq.com](https://console.groq.com) |

These keys are **encrypted on your OS** via the Tauri Stronghold secure store — never stored in plain text.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           Tauri Desktop Shell           │
│  ┌─────────────────────────────────┐    │
│  │  Next.js 16 + React 19 + R3F   │    │
│  │  (Chat, Particles, 3D Viewer)   │    │
│  └──────────────┬──────────────────┘    │
│                 │ IPC (invoke)           │
│  ┌──────────────▼──────────────────┐    │
│  │       Rust Backend (lib.rs)     │    │
│  │  Keychain, Process Management   │    │
│  └──────────────┬──────────────────┘    │
│                 │ Sidecar (stdio)        │
│  ┌──────────────▼──────────────────┐    │
│  │    Python FastMCP Server 3.1    │    │
│  │  AI Tools, Vision, TTS, DSP     │    │
│  └─────────────────────────────────┘    │
│                 │                        │
│    ┌────────────▼────────────┐          │
│    │   Ollama (Local LLM)    │          │
│    │   qwen3:8b / llama3     │          │
│    └─────────────────────────┘          │
└─────────────────────────────────────────┘
```

---

## 🔒 Security

- All AI inference runs **locally on your hardware** — no data leaves your machine
- API keys are encrypted via the **OS-native keychain** (macOS Keychain, Windows Credential Manager)
- The MCP Python sidecar uses **AST-based code sandboxing** to prevent code injection
- Tool arguments are validated against **function signatures** to block parameter injection
- File paths are **confined to the workspace directory** — no writes to system locations
- The CI/CD pipeline runs **gitleaks** for secret detection on every push

---

## 🗂️ Project Structure

```
desktop/
├── undesirables-ui/            # Tauri + Next.js frontend
│   ├── app/                    # React pages and components
│   │   ├── components/         # UI components (ChatInterface, MusicStudio, etc.)
│   │   ├── globals.css         # Design system (themes, animations)
│   │   └── page.js             # Main app entry
│   ├── src-tauri/              # Rust backend
│   │   ├── src/lib.rs          # IPC commands, process management
│   │   └── capabilities/       # Security permissions (CSP, URL allowlist)
│   ├── public/assets/          # Static images, banners
│   └── package.json
│
├── undesirables-mcp-server/    # Python AI engine
│   ├── server.py               # 50+ MCP tools (vision, TTS, DSP, search)
│   ├── execute_tool.py         # Secure tool dispatcher
│   ├── executor.py             # AST-sandboxed code runner
│   ├── ebay_oracle.py          # eBay market intelligence
│   ├── voice_engine.py         # Kokoro TTS integration
│   ├── requirements.txt        # Pinned Python dependencies
│   └── .env.example            # Template for API keys
│
└── README.md
```

---

## 📄 License

Business Source License (BSL) 1.1 — Proprietary license converting to Open Source after four years.

**The Undesirables LLC** · EST. 2026 · [the-undesirables.vercel.app](https://the-undesirables.vercel.app)

---

## ⚖️ Legal Disclaimer

**Not Financial Advice:** The Market Oracle, TCG Card Grader, and all AI-generated outputs are for **entertainment and educational purposes only**. AI models are prone to hallucinated metrics, inaccurate predictions, and stale caching. Do not execute trades, buy cards, or make financial decisions based on the outputs of this software. The creators accept no liability for financial losses.
