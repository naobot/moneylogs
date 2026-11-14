import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { db } from "@/config/firebase-config";
import { isNative, nativePlatform, storage } from "@/platform";

/**
 * Push notifications on this device. Opt-in from /me: nothing asks for permission or
 * creates a token until the person turns it on. The token lives at
 * users/{userDocId}/devices/{installId}, where sendPushOnNotification finds it.
 */

const INSTALL_ID_KEY = "ML__installId";
const PUSH_ON_KEY = "ML__pushOn";

/** A random id for this install, so a refreshed token replaces the old one in place. */
export const installId = (): string => {
  const existing = storage.get(INSTALL_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  storage.set(INSTALL_ID_KEY, id);
  return id;
};

const deviceRef = (userDocId: string) => doc(db, "users", userDocId, "devices", installId());

/** Only the native apps can receive push. */
export const pushAvailable = (): boolean => isNative();

/** Whether push was turned on here (the OS permission can still be revoked later). */
export const pushOnHere = (): boolean => storage.get(PUSH_ON_KEY) === "1";

export type PushState = "on" | "off" | "blocked";

/** What the /me row shows: on, off, or blocked in the phone's settings. */
export const pushState = (permission: string, onHere: boolean): PushState => {
  if (permission === "denied") return "blocked";
  return onHere && permission === "granted" ? "on" : "off";
};

export const readPushState = async (): Promise<PushState> => {
  try {
    const { receive } = await FirebaseMessaging.checkPermissions();
    return pushState(receive, pushOnHere());
  } catch {
    return "off";
  }
};

const saveToken = async (userDocId: string, token: string) => {
  await setDoc(deviceRef(userDocId), {
    token,
    platform: nativePlatform(),
    updatedAt: serverTimestamp(),
  });
};

/** Asks for permission, then registers this device. Resolves to the resulting state. */
export const turnPushOn = async (userDocId: string): Promise<PushState> => {
  const { receive } = await FirebaseMessaging.requestPermissions();
  if (receive !== "granted") return receive === "denied" ? "blocked" : "off";
  const { token } = await FirebaseMessaging.getToken();
  await saveToken(userDocId, token);
  storage.set(PUSH_ON_KEY, "1");
  return "on";
};

/**
 * Stops push to this device for `userDocId`: forgets the token on both sides. Also run
 * on sign-out, so the next person to sign in here doesn't get the last one's pushes.
 */
export const turnPushOff = async (userDocId: string | undefined): Promise<void> => {
  const wasOn = pushOnHere();
  storage.remove(PUSH_ON_KEY);
  if (!wasOn || !isNative()) return;
  await Promise.allSettled([
    userDocId ? deleteDoc(deviceRef(userDocId)) : Promise.resolve(),
    FirebaseMessaging.deleteToken(),
  ]);
};

/** Tokens rotate: re-save the current one at launch and whenever FCM issues a new one. */
export const refreshPushToken = async (userDocId: string, token?: string): Promise<void> => {
  if (!isNative() || !pushOnHere()) return;
  const current = token ?? (await FirebaseMessaging.getToken()).token;
  await saveToken(userDocId, current);
};

/** Where a tapped push opens: the inbox, which resolves the notification's own link. */
export const pushTapPath = (data: unknown): string | null => {
  const id =
    data && typeof data === "object" ? (data as Record<string, unknown>).notificationId : null;
  return typeof id === "string" && id ? `/notifications?open=${encodeURIComponent(id)}` : null;
};
