# FocusFlow - iOS & Android Build Guide

## 🎯 Overview

FocusFlow is a **Capacitor-based standalone app** that runs on iOS, Android, and Web. This guide focuses on building and installing the iOS version on your iPad/iPhone without a Mac.

---

## 📱 Building the App

### Prerequisites

1. **Node.js** (v16 or later) - [Download here](https://nodejs.org/)
2. **Git** - [Download here](https://git-scm.com/)

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/unclip12/FocusFlow.git
cd FocusFlow

# Install dependencies
npm install
```

### Step 2: Build for Mobile

```bash
# Build web assets and sync to mobile platforms
npm run build:mobile
```

This creates:
- `dist/` folder with web build
- `android/` folder with Android project
- `ios/` folder with iOS project

### Step 3: Generate APK (Android)

**Option A: Using Android Studio**
1. Open Android Studio
2. Open the `android/` folder
3. Go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**
4. APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

**Option B: Command Line** (requires Android SDK)
```bash
cd android
./gradlew assembleDebug
```

---

## 🍎 iOS Installation (Without Mac)

### Method 1: Sideloadly (Free, 7-Day Expiry)

#### Requirements:
- Windows PC
- iTunes (from Apple, NOT Microsoft Store)
- iCloud (from Apple)
- Lightning cable
- Free Apple ID

#### Steps:

**1. Install Prerequisites**
- Download [iTunes](https://www.apple.com/itunes/download/win64) from Apple
- Download [iCloud](https://support.apple.com/en-us/HT204283) from Apple
- Download [Sideloadly](https://sideloadly.io/)
- Restart your PC after installation

**2. Build IPA File**

Since you don't have Xcode, use one of these methods:

**Option A: GitHub Actions (Recommended)**
- I'll set this up for you - it builds IPA automatically on every commit
- Download the IPA from GitHub Actions artifacts

**Option B: Cloud Mac Service**
- Use [MacinCloud](https://www.macincloud.com/) (paid)
- Open Xcode on cloud Mac
- Open `ios/App/App.xcworkspace`
- Product → Archive → Export → Development
- Download the IPA file

**3. Sideload with Sideloadly**

1. Connect your iPad/iPhone via USB
2. Open Sideloadly
3. Drag the `.ipa` file into Sideloadly
4. Enter your Apple ID (free account works)
5. Click **Start**
6. On your device: Settings → General → VPN & Device Management
7. Trust your Apple ID certificate
8. Launch FocusFlow!

**⚠️ Limitations:**
- App expires every **7 days** (needs re-sideload)
- Maximum **3 apps** at once
- Must refresh weekly

---

### Method 2: AltStore (Free, Auto-Refresh)

#### Requirements:
- Same as Sideloadly
- AltStore installed on PC and iOS device

#### Steps:

**1. Install AltStore**
- Download [AltStore](https://altstore.io/) for Windows
- Follow [installation guide](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows)

**2. Install FocusFlow**
1. Open AltStore on your iPad
2. Tap **+** in top left
3. Select the `.ipa` file (transfer via Files app or AirDrop)
4. AltStore installs it

**✅ Benefits:**
- Auto-refreshes when on same WiFi
- No manual reinstall needed
- Same 7-day signing, but seamless

---

### Method 3: Apple Developer Program ($99/year)

#### Benefits:
- **No 7-day expiry** - apps last 1 year
- **TestFlight** - easy OTA installation
- **Unlimited apps**
- Professional development
- Can publish to App Store

#### Steps:

1. **Enroll** at [developer.apple.com](https://developer.apple.com/programs/)
2. **Get IPA** (via GitHub Actions or cloud Mac)
3. **Upload to TestFlight** via App Store Connect
4. **Install** via TestFlight app on iPad

**Recommended** if you use FocusFlow daily for studies!

---

## 🔄 Updating the App

### For Sideloadly/AltStore Users:
1. Pull latest code: `git pull`
2. Rebuild: `npm run build:mobile`
3. Generate new IPA
4. Sideload again (overwrites existing app, keeps data)

### For TestFlight Users:
1. Push code to GitHub
2. GitHub Actions builds new IPA
3. Upload to TestFlight
4. Update notification appears on device

---

## 🎨 iPadOS 26 Optimization

FocusFlow is optimized for your iPad Pro M4:
- ✅ Liquid Glass UI effects
- ✅ Full screen gestures
- ✅ Dark mode support
- ✅ Responsive layout for iPad screen
- ✅ Haptic feedback
- ✅ Native status bar

---

## 🔐 Data Sync

**Your data syncs automatically** across all versions:
- 📱 iOS standalone app
- 🤖 Android standalone app  
- 🌐 Web app (flow-app-dxv8.vercel.app)

All use the **same Firebase backend** - add a task on iPad, see it instantly on web!

---

## 🛠️ Troubleshooting

### "Untrusted Developer" on iOS
- Go to Settings → General → VPN & Device Management
- Tap your Apple ID
- Tap **Trust**

### App Crashes on Launch
- Delete app
- Reinstall with Sideloadly
- Ensure iTunes and iCloud are from Apple (not Microsoft Store)

### Build Errors
```bash
# Clear cache and rebuild
rm -rf node_modules dist android ios
npm install
npm run build:mobile
```

### Sideloadly "Could not find device"
- Unplug and replug USB cable
- Trust computer on iPad
- Restart Sideloadly
- Ensure iTunes is running in background

---

## 📚 Resources

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Sideloadly Guide](https://sideloadly.io/#faq)
- [AltStore FAQ](https://faq.altstore.io/)
- [Apple Developer Program](https://developer.apple.com/programs/)

---

## 🎓 Quick Start for Your Use Case

**You want:** Daily use on iPad Pro for studies

**Best option:**
1. Start with **Sideloadly** (free, test immediately)
2. After 2-3 weeks, subscribe to **Apple Developer** ($99/year)
3. Use **TestFlight** for hassle-free updates

**Why?** Reinstalling weekly is annoying for daily study apps. TestFlight is worth the investment!

---

## 🚀 Next: Setting Up Automatic Builds

Want me to set up GitHub Actions to automatically build APK + IPA on every code change?

It will:
- ✅ Build both Android APK and iOS IPA
- ✅ Upload as downloadable artifacts
- ✅ No local build needed
- ✅ Always ready to sideload

Let me know!
