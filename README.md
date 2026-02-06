# 🌌 Ultimate Media Universe (UMU)

**"Explore the infinity of your content."**

Ultimate Media Universe (UMU) is a next-generation, self-hosted media cataloging system designed to organize vast collections of digital assets into a coherent, galaxy-like interface. Whether it's high-resolution archives or serialized graphic novels, UMU provides a unified singularity for all your data.

![UMU Banner](https://placehold.co/1200x400/18181b/ec4899?text=Ultimate+Media+Universe)

## 🚀 Key Features

### 🔭 The Cosmos View (Unified UI)
Access all media types through a "Unified Card" interface using Glassmorphism design principles. Dark mode is enabled by default to reduce eye strain during long "observation" sessions.

### 🪐 Planetary Core (Media Support)
- **Video Module:** Advanced video playback with seekbar preview, loop controls, and theater mode.
- **Manga Reader:** Hybrid Reader supporting "Scroll" (Webtoon), "Spread" (Book), and "Single Page" modes with RTL support and markers.
- **Image Gallery:** Batch-enabled gallery for organizing large image collections with tags.
- **Audio Module:** Dedicated player with playlist support and file metadata integration.
- **Hyperlink Archive:** Manage bookmarks and external resources within the same universe.

### 🛰️ Exploration Rover (Scanner & AI)
- **Auto-Indexing:** The system automatically scans your library folder and generates optimized thumbnails via FFmpeg/Sharp.
- **Smart Search:** Filter content by tags, text query, or metadata properties.

### 🛡️ Black Hole Storage (Privacy)
All data remains local on your filesystem (`/library` directory). No cloud uploads, no telemetry. Your universe belongs only to you.

## 🛠️ Technology Stack
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Database:** SQLite (Prisma)
- **State:** Zustand
- **Containerization:** Docker & Docker Compose

## 🐳 Deployment (Docker / Raspberry Pi)

This system is optimized for containerized environments, including ARM64 devices like Raspberry Pi.

1.  **Prepare your media:**
    Organize your files on your host machine (e.g., external SSD).
    ```
    /mnt/ssd/media
      ├── videos
      ├── manga
      └── audio
    ```

2.  **Configure `docker-compose.yml`:**
    Point the volumes to your actual media paths.
    ```yaml
    volumes:
      - /mnt/ssd/media:/app/library
    ```

3.  **Launch the Universe:**
    ```bash
    docker-compose up -d --build
    ```

4.  **Access:**
    Open `http://<your-server-ip>:3000`.

## 🏁 Development Setup

1.  **Clone the Universe:**
    ```bash
    git clone https://github.com/your-username/ultimate-media-universe.git
    cd ultimate-media-universe/app
    ```

2.  **Install Dark Matter (Dependencies):**
    ```bash
    npm install
    ```

3.  **Ignite the Big Bang (Dev Server):**
    ```bash
    npm run dev
    ```

## 🤝 Configuration

Create a `.env.local` file in the `app` directory to customize your experience:

```bash
NEXT_PUBLIC_APP_NAME="Ultimate Media Universe"
NEXT_PUBLIC_AI_NAME="Core System"
```

## 📜 License
This project is licensed under the MIT License - see the LICENSE file for details.

---
*"The universe is under no obligation to make sense to you." - Neil deGrasse Tyson*
