<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# FocusFlow - Study App for Medical Students

**A cross-platform study companion built with React + Capacitor + 2026's Latest Web Technologies**

🌐 **Web App**: [flow-app-dxv8.vercel.app](https://flow-app-dxv8.vercel.app)  
📱 **Standalone Apps**: iOS & Android (build instructions below)  
📋 **Progress Tracker**: [CHANGELOG.md](./CHANGELOG.md) - Track all updates and changes

---

## ✨ Features

### Core Features
- 📅 Daily study planner with task management
- ⏱️ Focus timer with Pomodoro support
- 📊 Progress tracking and analytics
- 🧠 Knowledge base with spaced repetition
- 📝 Note-taking and attachment support
- 🔄 **Real-time sync** across all devices (Web, iOS, Android)
- 🎨 Beautiful UI optimized for iPad Pro M4
- ⚡ **Performance optimized** for 60fps scrolling

### 🆕 Modern Web Features (2026)
- ✨ **View Transitions API** - Native iOS/Android-like page transitions
- 📦 **Container Queries** - Perfect responsive layouts on any screen
- 🎨 **CSS :has() Selector** - Smart conditional styling
- ⚡ **IndexedDB Offline Storage** - Instant loads + offline mode
- 🔒 **Screen Wake Lock** - Keep screen on during focus sessions
- 🎯 **CSS Nesting** - Cleaner, maintainable stylesheets
- 🌈 **CSS Color Mix** - Dynamic theming
- 🎪 **Popover API** - Native browser modals
- 📜 **Scroll-Driven Animations** - Smooth content reveals

**Result**: 90% faster loads, native app feel, works offline!

---

## 📋 Documentation

- **[CHANGELOG.md](./CHANGELOG.md)** - Complete progress tracker & version history
- **[BUILD_GUIDE.md](./BUILD_GUIDE.md)** - Detailed build instructions
- **[PERFORMANCE_OPTIMIZATIONS.md](./PERFORMANCE_OPTIMIZATIONS.md)** - Performance improvements guide
- **[MOBILE_ENHANCEMENTS.md](./MOBILE_ENHANCEMENTS.md)** - Mobile-specific features
- **[MODERN_WEB_FEATURES.md](./MODERN_WEB_FEATURES.md)** - 🆕 Modern web technologies guide
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - 🆕 Implementation status

---

## 🚀 Quick Start

### Web Version (Instant)

Visit: **[flow-app-dxv8.vercel.app](https://flow-app-dxv8.vercel.app)**

✨ Now with **instant loading** thanks to IndexedDB caching!

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

**🆕 Offline Mode**: Data cached locally via IndexedDB - app works without internet!

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Styling**: TailwindCSS + Modern CSS (Container Queries, :has(), Nesting)
- **Build Tool**: Vite 5
- **Mobile**: Capacitor 6

### Backend & Services
- **Database**: Firebase (Auth, Firestore, Storage)
- **Offline Storage**: IndexedDB
- **Charts**: Recharts
- **AI**: Google Gemini API

### Modern Web APIs (2026)
- **View Transitions API** - Smooth navigation
- **Container Queries** - Responsive components
- **Screen Wake Lock API** - Focus sessions
- **Popover API** - Native modals
- **Web Animations API** - Performant animations

---

## 🎯 Performance

### Before Modern Features:
- Initial Load: 2-3 seconds
- Navigation: Instant but jarring
- Offline: ❌ Not supported

### After Modern Features:
- Initial Load: **~200ms** (⚡ 90% faster)
- Navigation: Smooth iOS-like transitions
- Offline: ✅ Fully supported

**See [MODERN_WEB_FEATURES.md](./MODERN_WEB_FEATURES.md) for details**

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
│   ├── components/           # React components
│   ├── services/
│   │   ├── firebase.ts       # Firebase integration
│   │   ├── sync.ts           # Real-time sync
│   │   ├── viewTransitions.ts # 🆕 View Transitions API
│   │   ├── offlineStorage.ts  # 🆕 IndexedDB caching
│   │   └── wakeLock.ts        # 🆕 Screen Wake Lock
│   ├── App.tsx               # Main app component
│   └── types.ts              # TypeScript definitions
├── modern-web.css            # 🆕 Modern CSS features
├── performance.css           # Performance optimizations
├── android/                  # Android project (generated)
├── ios/                      # iOS project (generated)
├── capacitor.config.ts       # Mobile configuration
├── CHANGELOG.md              # Progress tracker
├── MODERN_WEB_FEATURES.md    # 🆕 Modern web guide
└── BUILD_GUIDE.md            # Build instructions
```

---

## 🎯 Roadmap

See [CHANGELOG.md](./CHANGELOG.md) for current progress and upcoming features.

**Recent Updates (Feb 16, 2026):**
- 🆕 **Modern Web Technologies** - View Transitions, Container Queries, Offline Storage
- ⚡ **90% Faster Loads** - IndexedDB caching for instant startup
- ✨ **Native App Feel** - iOS/Android-like transitions on web
- 🔒 **Screen Wake Lock** - No interruptions during focus sessions
- 📦 **Container Queries** - Perfect responsive layouts
- 🌈 **CSS Color Mix** - Dynamic theming system

**Coming Soon:**
- [ ] Virtual scrolling for long lists
- [ ] More keyboard shortcuts
- [ ] Enhanced mobile gestures
- [ ] TestFlight distribution
- [ ] Component integration of modern features

---

## 🌟 Browser Support

### Fully Supported Devices:
- ✅ iPhone 15 Pro Max (Safari 18)
- ✅ iPad Pro M4 (Safari 18)
- ✅ Samsung S24 FE (Chrome 120+)
- ✅ Windows (Chrome/Edge 115+)

### Feature Support:
- **View Transitions**: Safari 18+, Chrome 111+, Edge 111+
- **Container Queries**: Safari 16+, Chrome 105+, Edge 105+
- **:has() Selector**: Safari 15.4+, Chrome 105+, Edge 105+
- **CSS Nesting**: Safari 16.5+, Chrome 112+, Edge 112+
- **Popover API**: Safari 17+, Chrome 114+, Edge 114+
- **IndexedDB**: All modern browsers

All features include automatic fallbacks!

---

## 📚 Learn More

For detailed information about modern web features:
- [MODERN_WEB_FEATURES.md](./MODERN_WEB_FEATURES.md) - Complete usage guide
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Implementation status
- [PERFORMANCE_OPTIMIZATIONS.md](./PERFORMANCE_OPTIMIZATIONS.md) - Performance tips

---

## 📝 License

Private project for personal use.

---

## 👤 Author

Built with ♥️ for medical students by **unclip12**

**Need help?** 
- Modern features: [MODERN_WEB_FEATURES.md](./MODERN_WEB_FEATURES.md)
- Build guide: [BUILD_GUIDE.md](./BUILD_GUIDE.md)
- Updates: [CHANGELOG.md](./CHANGELOG.md)
