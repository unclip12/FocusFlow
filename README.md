<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# FocusFlow - Study App for Medical Students

**A cross-platform study companion built with React + Capacitor**

🌐 **Web App**: [flow-app-dxv8.vercel.app](https://flow-app-dxv8.vercel.app)  
📱 **Standalone Apps**: iOS & Android (build instructions below)

---

## ✨ Features

- 📅 Daily study planner with task management
- ⏱️ Focus timer with Pomodoro support
- 📊 Progress tracking and analytics
- 🧠 Knowledge base with spaced repetition
- 📝 Note-taking and attachment support
- 🔄 **Real-time sync** across all devices (Web, iOS, Android)
- 🎨 Beautiful UI optimized for iPad Pro M4

---

## 🚀 Quick Start

### Web Version (Instant)

Visit: **[flow-app-dxv8.vercel.app](https://flow-app-dxv8.vercel.app)**

### Local Development

**Prerequisites:** Node.js v16+

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

### Standalone Mobile Apps

**Download Ready-to-Install Files:**

1. Go to [Actions tab](https://github.com/unclip12/FocusFlow/actions)
2. Click latest successful workflow run
3. Download:
   - **FocusFlow-Android-APK** (for Android devices)
   - **FocusFlow-iOS-IPA** (for iPhone/iPad)

**Installation Instructions:**
- **Android**: Transfer APK to phone and install directly
- **iOS**: See [BUILD_GUIDE.md](./BUILD_GUIDE.md) for sideloading with Sideloadly/AltStore

📚 **Full build guide**: [BUILD_GUIDE.md](./BUILD_GUIDE.md)

---

## 🔐 Data Sync

All versions (Web, iOS, Android) sync via **Firebase**:
- Add tasks on iPad → instantly visible on web
- Log study session on web → syncs to Android app
- One codebase, unified experience

---

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: TailwindCSS
- **Build Tool**: Vite
- **Mobile**: Capacitor 6
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Charts**: Recharts
- **AI**: Google Gemini API

---

## 📱 Mobile Commands

```bash
# Build for all platforms
npm run build:mobile

# Build for Android only
npm run build:android

# Build for iOS only
npm run build:ios

# Open in Android Studio
npm run android

# Open in Xcode (Mac only)
npm run ios
```

---

## 👨‍💻 Development

### Environment Setup

1. Create `.env.local` file:
```env
GEMINI_API_KEY=your_api_key_here
```

2. Configure Firebase:
- Add your Firebase config in `services/firebase.ts`
- Enable Authentication, Firestore, and Storage

### Project Structure

```
FocusFlow/
├── src/
│   ├── components/      # React components
│   ├── services/        # Firebase, sync, notifications
│   ├── App.tsx          # Main app component
│   └── types.ts         # TypeScript definitions
├── android/             # Android project (generated)
├── ios/                 # iOS project (generated)
├── capacitor.config.ts  # Mobile configuration
└── BUILD_GUIDE.md       # Detailed build instructions
```

---

## 🎯 Roadmap

- [ ] TestFlight distribution
- [ ] App Store / Play Store publishing
- [ ] Offline mode enhancements
- [ ] Collaborative study groups
- [ ] More AI-powered features

---

## 📝 License

Private project for personal use.

---

## 👤 Author

Built with ♥️ for medical students by **unclip12**

**Need help?** Check [BUILD_GUIDE.md](./BUILD_GUIDE.md) or open an issue!
