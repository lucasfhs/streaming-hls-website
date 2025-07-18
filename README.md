# HLS Video Streaming Platform

## 📋 Table of Contents

- [Project Description](#-project-description)
- [Overview](#-overview)
- [Technologies Used](#-technologies-used)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
- [Project Structure](#-project-structure)
- [Adding Videos](#-adding-videos)
- [Configuration](#-configuration)
- [Features](#-features)
- [Known Limitations](#-known-limitations)
- [License](#-license)

## 📝 Project Description

This is a complete, self-hosted video streaming solution that implements modern adaptive bitrate streaming using HLS (HTTP Live Streaming) technology. The platform automatically processes uploaded videos to create multiple quality versions (360p, 480p, 720p) and serves them efficiently to viewers based on their network conditions.

Key capabilities:

- End-to-end video streaming pipeline from upload to playback
- Adaptive streaming that automatically adjusts quality
- Modern web interface with quality selection
- Automatic thumbnail generation
- Easy to deploy and scale

The system is ideal for:

- Personal media servers
- Educational content platforms
- Corporate video portals
- Any application requiring efficient video delivery

## 📌 Overview

This project is a complete video streaming platform that uses HTTP Live Streaming (HLS) technology to deliver adaptive bitrate streaming. It consists of:

- **Backend**: Node.js server that processes videos, generates HLS streams at multiple quality levels (360p, 480p, 720p), and serves them to clients
- **Frontend**: React application with a responsive interface for browsing and watching videos with quality selection

Key features:

- Adaptive bitrate streaming for optimal playback quality
- Automatic thumbnail generation for videos
- Multi-quality HLS stream generation
- Modern player interface with manual quality selection
- Responsive design that works on desktop and mobile

## 🛠 Technologies Used

- **Backend**:

  - Node.js with Express
  - FFmpeg for video processing
  - HLS streaming protocol
  - CORS for cross-origin requests

- **Frontend**:
  - React
  - HLS.js for HLS playback in browsers
  - Radix UI for responsive components
  - Tailwind CSS for styling

## 🚀 Getting Started

### Prerequisites

1. **Node.js** (v16 or higher)
2. **npm** (comes with Node.js)
3. **FFmpeg** (must be installed and available in system PATH)
4. **PowerShell** (for running the setup script on Windows)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. Install dependencies for both frontend and backend:

   ```bash
   ./run-in-development-mode.ps1
   ```

   Or manually:

   ```bash
   # Frontend
   cd frontend
   npm install

   # Backend
   cd ../backend
   npm install
   ```

### Running the Application

1. **Using the PowerShell script** (recommended for Windows):

   ```bash
   ./run-in-development-mode.ps1
   ```

2. **Manually**:

   ```bash
   # In one terminal (backend)
   cd backend
   npm run dev

   # In another terminal (frontend)
   cd frontend
   npm run dev
   ```

The applications will be available at:

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## 📂 Project Structure

```
project-root/
├── backend/               # Node.js server code
│   ├── public/            # Static files (videos, thumbnails)
│   │   ├── videos/        # Original video files go here
│   │   └── thumbnails/    # Auto-generated thumbnails
│   ├── temp/              # Generated HLS streams
│   └── index.js           # Main server file
│
├── frontend/              # React application
│   ├── src/               # React components and logic
│   └── ...                # Standard React project structure
│
└── run-in-development-mode.ps1  # Setup and run script
```

## 🎬 Adding Videos

1. Place your video files (MP4, MKV, MOV, AVI) in the `backend/public/videos/` directory
2. The server will automatically:
   - Generate thumbnails
   - Create HLS streams at multiple qualities
   - Make them available in the player

## ⚙️ Configuration

You can modify video quality settings in `backend/index.js`:

```javascript
const qualityProfiles = [
  {
    name: "360p",
    resolution: "640x360",
    bandwidth: "800000",
    // ...
  },
  // ... other quality profiles
];
```

## 🌟 Features

- **Adaptive Bitrate Streaming**: Automatically adjusts quality based on network conditions
- **Manual Quality Selection**: Users can choose specific quality levels
- **Responsive Design**: Works on desktop and mobile devices
- **Video Thumbnails**: Automatically generated for all videos
- **Modern UI**: Clean interface with video browsing and playback

## 🛑 Known Limitations

- Initial video processing can be CPU intensive
- Requires FFmpeg installed on the system
- Safari has limited quality control due to native HLS implementation

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).

```

```
