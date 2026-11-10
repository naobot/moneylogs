import { lazy, Suspense, useMemo, useState } from "react";
import cx from "classnames";

import { LogPost } from "@/types/user";
import { useCurrentUser } from "@/contexts";
import { useLogPostQuery } from "@/hooks/useLogPostQuery";
import { useToastContext } from "@/hooks/useToastContext";
import { useReadTracking } from "@/hooks/useReadTracking";
import Modal from "@/components/Modal";
import RowButton from "@/components/RowButton";
import {
  canAddReaction,
  hasReacted,
  MAX_REACTIONS_PER_USER,
  reactorNames,
  summarizeReactions,
} from "@/utils/reactions";
import { useMemberNames } from "./memberNames";

import "./PostReactions.scss";

const EmojiPickerPanel = lazy(() => import("./EmojiPickerPanel"));

type PostReactionsProps = {
  post: LogPost;
  /** Members may react while the log is still writable, exactly as with comments. */
  canReact: boolean;
};

/**
 * Emoji reaction chips under a post, plus a button that opens the full picker. Clicking
 * a chip toggles your own reaction. Read-only logs and spectators see the chips only.
 */
export const PostReactions = ({ post, canReact }: PostReactionsProps) => {
  const { user: viewer } = useCurrentUser();
  const { toggleReactionFn } = useLogPostQuery();
  const { showToast } = useToastContext();
  const { trackUserAction } = useReadTracking();
  const memberNames = useMemberNames();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const viewerId = viewer?.id;
  const chips = useMemo(
    () => summarizeReactions(post.reactions, viewerId),
    [post.reactions, viewerId],
  );
  const interactive = canReact && !!viewerId;

  if (!chips.length && !interactive) return null;

  const toggle = async (emoji: string) => {
    if (!interactive || !viewerId) return;
    const add = !hasReacted(post.reactions, viewerId, emoji);
    if (add && !canAddReaction(post.reactions, viewerId, emoji)) {
      showToast(`You can leave up to ${MAX_REACTIONS_PER_USER} reactions on a post.`, "error");
      return;
    }
    try {
      await toggleReactionFn({ logPostId: post.id, userDocId: viewerId, emoji, add });
      if (add) trackUserAction("new_reaction");
    } catch (error) {
      console.error("Error toggling reaction:", error);
      showToast("Couldn't save your reaction. Try again?", "error");
    }
  };

  const pick = (emoji: string) => {
    setIsPickerOpen(false);
    // Picking an emoji you've already left keeps it rather than toggling it off.
    if (viewerId && hasReacted(post.reactions, viewerId, emoji)) return;
    void toggle(emoji);
  };

  return (
    <div className="PostReactions" aria-label="Reactions">
      {chips.map(({ emoji, count, mine, userIds }) => {
        const who = reactorNames(userIds, (id) => memberNames.get(id), viewerId);
        return (
          <button
            key={emoji}
            type="button"
            className={cx("PostReactions__chip", { "PostReactions__chip--mine": mine })}
            title={who}
            aria-label={`${emoji} ${count}, from ${who}`}
            aria-pressed={interactive ? mine : undefined}
            disabled={!interactive}
            onClick={() => void toggle(emoji)}
          >
            <span className="PostReactions__emoji">{emoji}</span>
            <span className="PostReactions__count">{count}</span>
          </button>
        );
      })}
      {interactive && (
        <RowButton
          glyph
          className="PostReactions__add"
          aria-label="Add a reaction"
          title="Add a reaction"
          onClick={() => setIsPickerOpen(true)}
        >
          +☺
        </RowButton>
      )}
      {interactive && (
        <Modal
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          className="PostReactions__modal"
        >
          <Modal.Header striped showCloseButton title="React">
            React
          </Modal.Header>
          <Modal.Body>
            <Suspense fallback={<p className="EmojiPicker__status">loading…</p>}>
              <EmojiPickerPanel onSelect={pick} />
            </Suspense>
          </Modal.Body>
        </Modal>
      )}
    </div>
  );
};

export default PostReactions;
