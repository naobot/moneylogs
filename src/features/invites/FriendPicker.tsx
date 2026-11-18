import { useState } from "react";
import { Link } from "react-router-dom";

import { useFriendships } from "@/hooks/useFriendships";
import { useProfiles } from "@/hooks/useProfiles";
import { useToastContext } from "@/hooks/useToastContext";
import type { LogKind } from "@/types/notification";
import { reportError } from "@/utils/reportError";
import Avatar from "@/components/Avatar";
import Button from "@/components/Button";

import { inviteFriendsToLog } from "./logInvites";
import { pickableFriends, toggleFriend } from "./friendPicking";
import "./invites.scss";
import { logKindParam, track } from "@/utils/analytics";

type FriendPickerProps = {
  selected: ReadonlyArray<string>;
  onChange: (ids: string[]) => void;
  /** Already in the log: left out of the list. */
  excludeIds?: ReadonlyArray<string>;
  /** Already invited this session: listed, but marked and not pickable. */
  invitedIds?: ReadonlyArray<string>;
  /** How many can be picked (the log's free spots). */
  max: number;
};

/**
 * Your friends as a checklist (name left, box right), for inviting into a log. Controlled:
 * the create wizard holds the picks until the log exists; InviteFriends sends them now.
 */
export const FriendPicker = ({
  selected,
  onChange,
  excludeIds = [],
  invitedIds = [],
  max,
}: FriendPickerProps) => {
  const { friends, isLoading } = useFriendships();
  const ids = pickableFriends(friends, excludeIds);
  const profiles = useProfiles(ids);

  if (isLoading) return <p className="FriendPicker__note">loading friends…</p>;
  if (!ids.length) {
    return (
      <p className="FriendPicker__note">
        {friends.length
          ? "all your friends are already in this log."
          : "no friends to invite yet. You can still share the link."}{" "}
        {!friends.length && <Link to="/me#friends">find friends</Link>}
      </p>
    );
  }

  const full = selected.length >= max;
  return (
    <ul className="FriendPicker" aria-label="friends">
      {ids.map((id) => {
        const profile = profiles.get(id);
        const name = profile?.displayName ?? "…";
        const invited = invitedIds.includes(id);
        const checked = selected.includes(id);
        return (
          <li key={id}>
            <label className="FriendPicker__row">
              <span className="FriendPicker__who">
                <Avatar avatar={profile?.avatar} name={name} size={30} />
                <span className="keep-case">{name}</span>
              </span>
              {invited ? (
                <span className="FriendPicker__status">invited</span>
              ) : (
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && full}
                  onChange={() => onChange(toggleFriend(selected, id, max))}
                  aria-label={`invite ${name}`}
                />
              )}
            </label>
          </li>
        );
      })}
    </ul>
  );
};

type InviteFriendsProps = {
  logId: string;
  logKind: LogKind;
  memberIds: ReadonlyArray<string>;
  spotsLeft: number;
};

/** The invite modal's "friends" part: pick friends and send them each an invite. */
export const InviteFriends = ({ logId, logKind, memberIds, spotsLeft }: InviteFriendsProps) => {
  const { showToast } = useToastContext();
  const [selected, setSelected] = useState<string[]>([]);
  const [invited, setInvited] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!selected.length || sending) return;
    setSending(true);
    try {
      const result = await inviteFriendsToLog(logId, logKind, selected);
      setInvited((prev) => [...prev, ...result.invited]);
      setSelected([]);
      const n = result.invited.length;
      if (n)
        track("invite_friends_to_log", { log_kind: logKindParam(logKind), invited_friends: n });
      showToast(n ? `Invite${n > 1 ? "s" : ""} sent` : "Nobody new to invite", "success");
    } catch (err) {
      reportError(err, { feature: "log_invites", action: "invite_friends", tags: { logKind } });
      showToast("Couldn't send those invites. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="InviteFriends">
      <h4>invite friends</h4>
      <FriendPicker
        selected={selected}
        onChange={setSelected}
        excludeIds={memberIds}
        invitedIds={invited}
        max={Math.max(0, spotsLeft - invited.length)}
      />
      {selected.length > 0 && (
        <Button
          size="sm"
          variant="primary"
          text={sending ? "Sending…" : `Invite ${selected.length}`}
          onClick={() => void send()}
          disabled={sending}
        />
      )}
    </div>
  );
};

export default InviteFriends;
