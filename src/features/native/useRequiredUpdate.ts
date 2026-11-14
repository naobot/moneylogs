import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { App as CapApp } from "@capacitor/app";
import { db } from "@/config/firebase-config";
import { nativePlatform } from "@/platform";
import { RequiredUpdate, requiredUpdate } from "./minVersion";

/**
 * In the native app, whether this build is below `config/app.minNativeVersion` and must
 * be updated from the store. Checked at launch and whenever the app returns to the
 * foreground. Always null on the web, and null whenever the check can't complete
 * (offline, missing doc): the gate fails open.
 */
export const useRequiredUpdate = (): RequiredUpdate | null => {
  const [update, setUpdate] = useState<RequiredUpdate | null>(null);

  useEffect(() => {
    const platform = nativePlatform();
    if (!platform) return;
    let cancelled = false;

    const check = async () => {
      try {
        const [{ version }, snap] = await Promise.all([
          CapApp.getInfo(),
          getDoc(doc(db, "config", "app")),
        ]);
        if (!cancelled) setUpdate(requiredUpdate(snap.data(), version, platform));
      } catch {
        // Fail open: never block the app because the check itself failed.
      }
    };

    void check();
    const listener = CapApp.addListener("resume", () => void check());
    return () => {
      cancelled = true;
      void listener.then((handle) => handle.remove());
    };
  }, []);

  return update;
};
