# CursorVoice

**Dictate text, it appears at your cursor.** Open-source desktop voice dictation app with local transcription via Whisper.

## Features

- **Global shortcut** - `Ctrl+Shift+H` from any app
- **Local transcription** - 100% offline via whisper.cpp, no data sent anywhere
- **Auto-paste** - Text appears directly at your cursor position
- **Multi-language** - French, English, Spanish, German + auto-detection
- **System tray** - Runs in background, always available

## Download

| Platform | Download |
|----------|----------|
| **Windows** | [CursorVoice Setup](https://github.com/TF-2022/cursorvoice/releases/latest) |
| **macOS (Apple Silicon)** | [CursorVoice.dmg](https://github.com/TF-2022/cursorvoice/releases/latest) |
| **macOS (Intel)** | [CursorVoice.dmg](https://github.com/TF-2022/cursorvoice/releases/latest) |

## Development

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
git clone https://github.com/TF-2022/cursorvoice.git
cd cursorvoice
npm install
npm run setup    # Downloads whisper.cpp + ffmpeg
npm run dev      # Starts the app in dev mode
```

### Build

```bash
npm run dist:win   # Windows NSIS installer
npm run dist:mac   # macOS DMG
npm run dist:all   # Both
```

## Tech stack

- **Electron** - Cross-platform desktop framework
- **React + TypeScript** - UI
- **Tailwind CSS** - Styling
- **whisper.cpp** - Local transcription (OpenBLAS, multi-thread)
- **ffmpeg** - Audio conversion
- **electron-vite** - Build tooling

## How it works

1. Press `Ctrl+Shift+H` (customizable)
2. Speak into your mic
3. Press again to stop
4. Transcribed text is pasted at your cursor automatically

The Whisper model runs locally. No internet connection required.

## License

[AGPL-3.0](LICENSE)
