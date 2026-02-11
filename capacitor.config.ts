import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.focusflow.app',
  appName: 'FocusFlow',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
      // iOS-specific: Add toolbar with Done button
      accessoryBarVisible: true,
      // Scroll to focused input automatically
      scrollAssist: true,
      // Better behavior when keyboard dismisses
      hideFormAccessoryBar: false
    },
    StatusBar: {
      style: 'DARK',
      overlaysWebView: false,
    }
  }
};

export default config;