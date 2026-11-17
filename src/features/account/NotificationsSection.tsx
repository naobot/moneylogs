import { useAuthState } from "react-firebase-hooks/auth";

import { auth } from "@/config/firebase-config";
import { useCurrentUser } from "@/contexts";
import { useToastContext } from "@/hooks/useToastContext";
import { updateUserFields, UserFieldsPatch } from "@/hooks/useUserQuery";
import { reportError } from "@/utils/reportError";
import {
  Channel,
  CHANNEL_LABELS,
  channelOf,
  channelPatch,
  channelsFor,
  NOTIFICATION_SETTING_GROUPS,
  settingLabel,
} from "./notificationSettings";

import "./NotificationsSection.scss";

/**
 * Where each kind of notification goes: the inbox plus the daily email digest, the
 * inbox only, or nowhere. Changes save as they're made.
 */
export const NotificationsSection = () => {
  const [firebaseUser] = useAuthState(auth);
  const { user } = useCurrentUser();
  const { showToast } = useToastContext();

  const email = firebaseUser?.email ?? user?.email;
  const unverified = !!firebaseUser && !firebaseUser.emailVerified;
  const paused = !!user?.emailPaused;

  const save = async (patch: UserFieldsPatch, action: string) => {
    if (!user?.id) return;
    try {
      await updateUserFields(user.id, patch);
    } catch (err) {
      reportError(err, { feature: "notifications", action });
      showToast("Couldn't save that setting. Please try again.");
    }
  };

  return (
    <>
      <label className="NotificationsSection__digest">
        <input
          type="checkbox"
          checked={!paused}
          onChange={(e) => save({ emailPaused: !e.target.checked }, "toggle_email_digest")}
        />
        <span>Email me a daily digest of what I haven't seen</span>
      </label>
      <p className="NotificationsSection__hint">
        {unverified
          ? "Verify your email address to receive the digest."
          : paused
            ? "Email is paused. The inbox still gets everything switched on below."
            : `Sent in the evening, your time, to ${email ?? "your email"}.`}
      </p>

      {NOTIFICATION_SETTING_GROUPS.map((group) => (
        <section key={group.title} className="NotificationsSection__group">
          <h3>{group.title}</h3>
          {group.keys.map((key) => {
            const id = `notif-pref-${key}`;
            return (
              <div key={key} className="NotificationsSection__row">
                <label htmlFor={id}>{settingLabel(key)}</label>
                <select
                  id={id}
                  value={channelOf(user, key)}
                  onChange={(e) =>
                    save(channelPatch(key, e.target.value as Channel), "set_notification_channel")
                  }
                >
                  {channelsFor(key).map((channel) => (
                    <option key={channel} value={channel}>
                      {key === "budget_category" && channel === "inbox"
                        ? "on"
                        : CHANNEL_LABELS[channel]}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
          {group.keys.includes("budget_category") && (
            <p className="NotificationsSection__hint">
              Per-category alerts follow the budget settings above.
            </p>
          )}
        </section>
      ))}
    </>
  );
};

export default NotificationsSection;
