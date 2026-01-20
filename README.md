# 🌌 Ultimate Media Universe (UMU)

**"Explore the infinity of your content."**

Ultimate Media Universe (UMU) is a next-generation, self-hosted media cataloging system designed to organize vast collections of digital assets into a coherent, galaxy-like interface. Whether it's high-resolution archives or serialized graphic novels, UMU provides a unified singularity for all your data.

![UMU Banner](https://placehold.co/1200x400/18181b/ec4899?text=Ultimate+Media+Universe)

## 🚀 Key Features

### 🔭 The Cosmos View (Unified UI)
Access all media types through a "Unified Card" interface using Glassmorphism design principles. Dark mode is enabled by default to reduce eye strain during long "observation" sessions.

### 🪐 Planetary Core (Media Support)
- **Video Module (Available):** Standard video playback with seekbar preview and theater mode.
- **Manga Reader (Available):** Advanced Hybrid Reader supporting both "Scroll" (Webtoon) and "Spread" (Book) modes for optimal viewing of comic sequences.
- **Image Gallery:** *[Coming Soon]* - Full-feature image viewer and tagging system.
- **Audio Module:** *[Coming Soon]* - Planned support for background playback and visualization.

### 🛰️ Exploration Rover (Scanner & AI)
- **Auto-Indexing:** The system (codenamed "Core System") automatically scans your library folder and generates optimized thumbnails.
- **AI Suggestions:** *[Experimental]* - Currently provides randomized content discovery. Intelligent recommendation based on usage patterns is in development.

### 🛡️ Black Hole Storage (Privacy)
All data remains local on your filesystem (`/library` directory). No cloud uploads, no telemetry. Your universe belongs only to you.

## 🛠️ Technology Stack
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Database:** SQLite (Prisma)
- **State:** Zustand

## 🏁 Getting Started

1.  **Clone the Universe:**
    ```bash
    git clone https://github.com/your-username/ultimate-media-universe.git
    cd ultimate-media-universe
    ```

2.  **Enter the Application Core:**
    ```bash
    cd app
    ```

3.  **Initialize Dark Matter (Dependencies):**
    ```bash
    npm install
    # or
    yarn
    ```

4.  **Ignite the Big Bang (Dev Server):**
    ```bash
    npm run dev
    ```

5.  **Observe:**
    Open [http://localhost:3000](http://localhost:3000) to view your universe.

## 🤝 Configuration

Create a `.env.local` file in the `app` directory to customize your experience:

```bash
NEXT_PUBLIC_APP_NAME="Ultimate Media Universe"
NEXT_PUBLIC_AI_NAME="Core System" # Or your preferred assistant name
```

## 📜 License
This project is licensed under the MIT License - see the LICENSE file for details.

---
*"The universe is under no obligation to make sense to you." - Neil deGrasse Tyson*
