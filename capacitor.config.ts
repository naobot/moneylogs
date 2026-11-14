import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

// Native shells (ios/, android/) load the same Vite build as the web app from dist/.
// Build first: `npm run cap:sync` runs `vp build` and copies it into both projects.
const config: CapacitorConfig = {
  appId: "app.moneylogs",
  appName: "moneylogs",
  webDir: "dist",
  plugins: {
    // The WebView itself shrinks above the keyboard, so utils/keyboardInset measures
    // nothing left over and layouts don't double-count it.
    Keyboard: { resize: KeyboardResize.Native },
    // Shown until NativeBridge hides it once auth has resolved, so the app never flashes
    // the login page for someone who is signed in.
    SplashScreen: { launchAutoHide: false },
  },
};

export default config;
