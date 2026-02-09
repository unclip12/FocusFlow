# FocusFlow - Mobile Enhancement Roadmap

**Last Updated:** February 9, 2026  
**Status:** Planning Phase  
**Target Platform:** iOS & Android (Capacitor 6)

---

## 📊 Current State

### ✅ Implemented
- [x] Basic Capacitor configuration
- [x] Native back button handling
- [x] Status bar theming (dark/light)
- [x] Firebase real-time sync
- [x] Dark mode support
- [x] Responsive layout
- [x] Keyboard configuration (basic)

### ❌ Missing
- [ ] Haptic feedback
- [ ] Splash screen
- [ ] App icons (all sizes)
- [ ] Network detection
- [ ] Native sharing
- [ ] Offline mode
- [ ] Deep linking
- [ ] Local notifications
- [ ] Swipe gestures
- [ ] Pull-to-refresh

---

## 🎯 Enhancement Phases

### **Phase 1: Core Mobile Experience** (HIGH PRIORITY)

#### 1.1 Splash Screen & App Icon ⏳ NOT STARTED
**Goal:** Professional branded loading experience

**Tasks:**
- [ ] Create splash screen assets (2048x2732 iOS, 1920x1080 Android)
- [ ] Generate app icons for all sizes
- [ ] Configure `@capacitor/splash-screen`
- [ ] Add fade animation
- [ ] Test on both platforms

**Files to modify:**
- `capacitor.config.ts`
- `package.json` (add splash-screen plugin)
- New: `resources/splash.png`
- New: `resources/icon.png`

**Estimated time:** 30 minutes

---

#### 1.2 Haptic Feedback ⏳ NOT STARTED
**Goal:** Tactile feedback for user actions

**Tasks:**
- [ ] Install `@capacitor/haptics`
- [ ] Create `services/hapticsService.ts`
- [ ] Add haptics to:
  - [ ] Task completion
  - [ ] Timer start/stop
  - [ ] Button presses (primary actions)
  - [ ] Swipe gestures
  - [ ] Successful saves
  - [ ] Delete confirmations

**Files to modify:**
- `package.json`
- New: `services/hapticsService.ts`
- `App.tsx` (import and use)
- `components/SessionModal.tsx`
- `components/TodaysPlanView.tsx`
- `components/FocusTimerView.tsx`

**Code example:**
```typescript
// services/hapticsService.ts
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export const haptic = {
  light: () => Capacitor.isNativePlatform() && Haptics.impact({ style: ImpactStyle.Light }),
  medium: () => Capacitor.isNativePlatform() && Haptics.impact({ style: ImpactStyle.Medium }),
  heavy: () => Capacitor.isNativePlatform() && Haptics.impact({ style: ImpactStyle.Heavy }),
  success: () => Capacitor.isNativePlatform() && Haptics.notification({ type: 'SUCCESS' }),
  warning: () => Capacitor.isNativePlatform() && Haptics.notification({ type: 'WARNING' }),
  error: () => Capacitor.isNativePlatform() && Haptics.notification({ type: 'ERROR' })
};
```

**Estimated time:** 45 minutes

---

#### 1.3 Enhanced Keyboard Handling ⏳ NOT STARTED
**Goal:** Smooth keyboard experience

**Tasks:**
- [ ] Update keyboard config in `capacitor.config.ts`
- [ ] Auto-scroll to focused input
- [ ] Prevent background scroll
- [ ] Add keyboard toolbar (iOS)
- [ ] Handle keyboard show/hide events

**Files to modify:**
- `capacitor.config.ts`
- `App.tsx` (add keyboard listeners)
- `components/SessionModal.tsx`
- `components/AIChatView.tsx`

**Estimated time:** 20 minutes

---

#### 1.4 Native Sharing ⏳ NOT STARTED
**Goal:** Share study data natively

**Tasks:**
- [ ] Install `@capacitor/share`
- [ ] Create `services/nativeShareService.ts`
- [ ] Add share buttons to:
  - [ ] Study sessions
  - [ ] Progress stats
  - [ ] Knowledge base entries
  - [ ] Daily summaries

**Files to modify:**
- `package.json`
- New: `services/nativeShareService.ts`
- `components/SessionModal.tsx`
- `components/PageDetailModal.tsx`
- `components/StatsCard.tsx`

**Estimated time:** 30 minutes

---

#### 1.5 Network Detection ⏳ NOT STARTED
**Goal:** Offline awareness and queueing

**Tasks:**
- [ ] Install `@capacitor/network`
- [ ] Create `services/networkService.ts`
- [ ] Add offline indicator to header
- [ ] Queue Firebase writes when offline
- [ ] Auto-retry on reconnection
- [ ] Show offline banner

**Files to modify:**
- `package.json`
- New: `services/networkService.ts`
- New: `services/offlineQueueService.ts`
- `App.tsx` (network listener)
- `services/firebase.ts` (queue writes)

**Estimated time:** 1 hour

---

### **Phase 2: Performance & Polish** (MEDIUM PRIORITY)

#### 2.1 App Lifecycle Management ⏳ NOT STARTED
**Goal:** Handle app state changes gracefully

**Tasks:**
- [ ] Pause timers on app background
- [ ] Show notification when paused
- [ ] Resume timers on foreground
- [ ] Save state on app close
- [ ] Optimize background sync

**Files to modify:**
- `App.tsx`
- `components/FocusTimerView.tsx`
- New: `services/lifecycleService.ts`

**Estimated time:** 45 minutes

---

#### 2.2 Deep Linking ⏳ NOT STARTED
**Goal:** Open specific screens from external links

**Tasks:**
- [ ] Configure URL schemes (`focusflow://`)
- [ ] Handle deep link routes
- [ ] Support links:
  - `focusflow://today`
  - `focusflow://timer`
  - `focusflow://log`
  - `focusflow://page/123`

**Files to modify:**
- `capacitor.config.ts`
- `App.tsx` (deep link handler)
- New: `services/deepLinkService.ts`

**Estimated time:** 40 minutes

---

#### 2.3 Native Notifications ⏳ NOT STARTED
**Goal:** Replace web notifications with native

**Tasks:**
- [ ] Install `@capacitor/local-notifications`
- [ ] Migrate from web notifications
- [ ] Schedule study reminders
- [ ] Break reminders during focus
- [ ] Daily streak reminders
- [ ] Revision due alerts

**Files to modify:**
- `package.json`
- `services/notificationService.ts` (rewrite)
- `components/FocusTimerView.tsx`
- `App.tsx`

**Estimated time:** 1.5 hours

---

#### 2.4 Better Gestures ⏳ NOT STARTED
**Goal:** Natural mobile interactions

**Tasks:**
- [ ] Swipe to complete tasks
- [ ] Pull to refresh on dashboard
- [ ] Swipe between calendar dates
- [ ] Long-press context menus
- [ ] Pinch to zoom (knowledge base)

**Files to modify:**
- `components/TodaysPlanView.tsx`
- `components/Dashboard.tsx` (in App.tsx)
- `components/CalendarView.tsx`
- `components/KnowledgeBaseView.tsx`

**Estimated time:** 2 hours

---

#### 2.5 Performance Optimizations ⏳ NOT STARTED
**Goal:** Faster app startup and navigation

**Tasks:**
- [ ] Lazy load components
- [ ] Code splitting by route
- [ ] Optimize images
- [ ] Reduce bundle size
- [ ] Implement virtual scrolling
- [ ] Cache frequently accessed data

**Files to modify:**
- `App.tsx` (lazy imports)
- `vite.config.ts` (chunking)
- All component files (lazy loading)

**Estimated time:** 3 hours

---

### **Phase 3: Advanced Features** (NICE TO HAVE)

#### 3.1 Biometric Authentication ⏳ NOT STARTED
- [ ] FaceID / TouchID support
- [ ] App lock setting
- [ ] Quick unlock

**Estimated time:** 1 hour

---

#### 3.2 Widgets ⏳ NOT STARTED
- [ ] Today's tasks widget (iOS/Android)
- [ ] Streak counter widget
- [ ] Quick timer widget

**Estimated time:** 4 hours (complex)

---

#### 3.3 App Shortcuts ⏳ NOT STARTED
- [ ] 3D Touch shortcuts (iOS)
- [ ] Long-press app icon shortcuts (Android)

**Estimated time:** 1 hour

---

#### 3.4 iPad Optimizations ⏳ NOT STARTED
- [ ] Split view support
- [ ] Drag & drop between views
- [ ] Keyboard shortcuts
- [ ] Apple Pencil for notes

**Estimated time:** 3 hours

---

#### 3.5 Storage Management ⏳ NOT STARTED
- [ ] Clear cache option
- [ ] Manage attachments
- [ ] Export data to device
- [ ] Local backup

**Estimated time:** 2 hours

---

## 🛠️ Required Dependencies

### To Install:
```json
{
  "@capacitor/haptics": "^6.0.0",
  "@capacitor/splash-screen": "^6.0.0",
  "@capacitor/network": "^6.0.0",
  "@capacitor/share": "^6.0.0",
  "@capacitor/local-notifications": "^6.0.0",
  "@capacitor/app-launcher": "^6.0.0",
  "@capacitor/filesystem": "^6.0.0",
  "@capacitor/device": "^6.0.0"
}
```

### Already Installed:
- ✅ `@capacitor/core`
- ✅ `@capacitor/android`
- ✅ `@capacitor/ios`
- ✅ `@capacitor/app`
- ✅ `@capacitor/keyboard`
- ✅ `@capacitor/status-bar`

---

## 📈 Progress Tracker

### Overall Progress
```
Phase 1: 0/5 tasks (0%)
Phase 2: 0/5 tasks (0%)
Phase 3: 0/5 tasks (0%)

Total: 0/15 major features (0%)
```

### Quick Wins (Can do today!)
- [ ] Add haptic feedback to timer
- [ ] Network status indicator
- [ ] Pull-to-refresh on dashboard
- [ ] Native share for sessions
- [ ] Configure splash screen

---

## 🎯 Next Steps

### Immediate (This Session)
1. ✅ Create this roadmap document
2. ⏳ Install Phase 1 dependencies
3. ⏳ Implement haptic feedback service
4. ⏳ Add network detection
5. ⏳ Configure splash screen

### Short Term (This Week)
- Complete Phase 1 (all 5 tasks)
- Test on real devices
- Gather user feedback

### Long Term (This Month)
- Complete Phase 2
- Begin Phase 3 features
- Prepare for App Store/Play Store launch

---

## 📝 Notes

### Design Decisions
- **Haptics:** Use sparingly, only for meaningful actions
- **Offline mode:** Queue up to 100 actions, show count in header
- **Notifications:** Respect quiet hours from settings
- **Gestures:** Make all swipes cancellable (spring back animation)

### Performance Targets
- Cold start: < 2 seconds
- Hot start: < 0.5 seconds
- Navigation: < 100ms
- Offline sync queue: < 1 second

### Testing Checklist
- [ ] Test on iPhone (iOS 15+)
- [ ] Test on iPad (iPadOS 15+)
- [ ] Test on Android phone (Android 11+)
- [ ] Test on Android tablet
- [ ] Test offline mode
- [ ] Test background/foreground transitions
- [ ] Test with poor network
- [ ] Test deep links

---

## 🤝 Contributing

When implementing a feature:
1. Mark task as "🚧 IN PROGRESS" in this doc
2. Create a branch: `feature/haptic-feedback`
3. Implement and test
4. Update this doc with results
5. Mark as ✅ DONE
6. Commit with message referencing this doc

---

## 📊 Impact Metrics

### Expected Improvements
| Metric | Before | Target |
|--------|--------|--------|
| Cold start | ~3s | ~1.5s |
| User retention | Baseline | +40% |
| App rating | N/A | 4.5+⭐ |
| Native feel | 60% | 95% |
| Offline usability | 20% | 100% |

---

**Last reviewed:** February 9, 2026  
**Next review:** February 16, 2026  
**Owner:** unclip12
