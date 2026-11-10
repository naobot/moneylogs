import { lazy, PointerEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import cx from "classnames";

import { LogPost } from "@/types/user";
import { useCurrentUser } from "@/contexts";
import { useLogPostQuery } from "@/hooks/useLogPostQuery";
import { useToastContext } from "@/hooks/useToastContext";
import { useReadTracking } from "@/hooks/useReadTracking";
import Icon from "@/components/Icon";
import Popover from "@/components/Popover";
import RowButton from "@/components/RowButton";
import {
  canAddReaction,
  hasReacted,
  MAX_INLINE_REACTIONS,
  MAX_REACTIONS_PER_USER,
  QUICK_REACTIONS,
  reactorNames,
  ReactionSummary,
  summarizeReactions,
} from "@/utils/reactions";
import { useMemberNames } from "./memberNames";

import "./PostReactions.scss";

const EmojiPickerPanel = lazy(() => import("./EmojiPickerPanel"));

// Hover-to-preview only makes sense with a real pointer; touch goes straight to click.
const isMouse = (e: PointerEvent) => e.pointerType === "mouse";
const HOVER_CLOSE_DELAY = 200;

type Panel = "quick" | "picker" | "details" | null;

type PostReactionsProps = {
  post: LogPost;
  /** Members may react while the log is still writable, exactly as with comments. */
  canReact: boolean;
};

/**
 * Reactions in a post header, just left of the comment bubble: the applied emoji with
 * counts (at most four inline; the rest are clipped), then the pixel-smiley react button.
 *
 * - Hovering an applied emoji names who left it; clicking the applied emoji opens a
 *   panel listing every reaction and everyone who left it.
 * - Hovering the smiley offers a curated row; clicking it opens the full picker.
 * - Read-only logs and spectators see the applied emoji and the details panel only.
 */
export const PostReactions = ({ post, canReact }: PostReactionsProps) => {
  const { user: viewer } = useCurrentUser();
  const { toggleReactionFn } = useLogPostQuery();
  const { showToast } = useToastContext();
  const { trackUserAction } = useReadTracking();
  const memberNames = useMemberNames();

  const [panel, setPanel] = useState<Panel>(null);
  const [hovered, setHovered] = useState<{ emoji: string; el: HTMLElement } | null>(null);
  // Elements in state (callback refs) so the popovers re-render once their anchor exists.
  const [appliedEl, setAppliedEl] = useState<HTMLButtonElement | null>(null);
  const [triggerEl, setTriggerEl] = useState<HTMLButtonElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const viewerId = viewer?.id;
  const tallies = useMemo(
    () => summarizeReactions(post.reactions, viewerId),
    [post.reactions, viewerId],
  );
  const interactive = canReact && !!viewerId;

  if (!tallies.length && !interactive) return null;

  const nameOf = (id: string) => memberNames.get(id);
  const close = () => setPanel(null);

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

  // From the full picker: choosing one you've already left keeps it.
  const pick = (emoji: string) => {
    close();
    if (viewerId && hasReacted(post.reactions, viewerId, emoji)) return;
    void toggle(emoji);
  };

  // The quick row stays open while the pointer moves between the smiley and the row.
  const holdQuick = () => clearTimeout(closeTimer.current);
  const releaseQuick = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(
      () => setPanel((current) => (current === "quick" ? null : current)),
      HOVER_CLOSE_DELAY,
    );
  };

  const quickRow = (
    <div className="ReactionQuick__row" role="group" aria-label="Quick reactions">
      {QUICK_REACTIONS.map((emoji) => {
        const mine = !!viewerId && hasReacted(post.reactions, viewerId, emoji);
        return (
          <button
            key={emoji}
            type="button"
            className={cx("ReactionQuick__emoji", { "ReactionQuick__emoji--mine": mine })}
            aria-pressed={mine}
            onClick={() => {
              close();
              void toggle(emoji);
            }}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );

  const inline = tallies.slice(0, MAX_INLINE_REACTIONS);
  const hidden = tallies.length - inline.length;

  return (
    <div className="PostReactions">
      {tallies.length > 0 && (
        <button
          ref={setAppliedEl}
          type="button"
          className="PostReactions__applied"
          aria-label={`Reactions: ${tallies.map((t) => `${t.emoji} ${t.count}`).join(", ")}. Show who reacted`}
          aria-expanded={panel === "details"}
          onClick={() => {
            setHovered(null);
            setPanel(panel === "details" ? null : "details");
          }}
        >
          {inline.map(({ emoji, count }) => (
            <span
              key={emoji}
              className={cx("PostReactions__tally", {
                "PostReactions__tally--mine": hasReacted(post.reactions, viewerId ?? "", emoji),
              })}
              onPointerEnter={(e) =>
                isMouse(e) && panel !== "details" && setHovered({ emoji, el: e.currentTarget })
              }
              onPointerLeave={() => setHovered(null)}
            >
              <span className="PostReactions__emoji">{emoji}</span>
              <span className="PostReactions__count">{count}</span>
            </span>
          ))}
          {hidden > 0 && (
            <span className="PostReactions__more" aria-hidden="true">
              …
            </span>
          )}
        </button>
      )}

      {interactive && (
        <button
          ref={setTriggerEl}
          type="button"
          className={cx("PostReactions__trigger", {
            "PostReactions__trigger--open": panel === "quick" || panel === "picker",
          })}
          aria-label="React"
          aria-haspopup="dialog"
          aria-expanded={panel === "picker"}
          onPointerEnter={(e) => {
            if (!isMouse(e)) return;
            holdQuick();
            if (!panel) setPanel("quick");
          }}
          onPointerLeave={(e) => isMouse(e) && releaseQuick()}
          onClick={() => {
            clearTimeout(closeTimer.current);
            setPanel(panel === "picker" ? null : "picker");
          }}
        >
          <Icon type="smiley" size={18} />
        </button>
      )}

      {/* Who left one emoji (mouse hover over its tally). */}
      <Popover
        anchor={hovered?.el ?? null}
        open={!!hovered && panel !== "details"}
        placement="top"
        interactive={false}
        className="ReactionTooltip"
        role="tooltip"
      >
        {hovered && (
          <TooltipText
            tally={tallies.find((t) => t.emoji === hovered.emoji)}
            nameOf={nameOf}
            viewerId={viewerId}
          />
        )}
      </Popover>

      {/* Curated row on hovering the smiley. */}
      <Popover
        anchor={triggerEl}
        open={panel === "quick"}
        onClose={close}
        placement="top"
        align="end"
        className="ReactionQuick"
        onPointerEnter={holdQuick}
        onPointerLeave={releaseQuick}
      >
        {quickRow}
      </Popover>

      {/* Full palette on clicking the smiley. */}
      <Popover
        anchor={triggerEl}
        open={panel === "picker"}
        onClose={close}
        placement="bottom"
        align="end"
        className="ReactionPicker"
        role="dialog"
        aria-label="Choose a reaction"
      >
        {quickRow}
        <Suspense fallback={<p className="EmojiPicker__status">loading…</p>}>
          <EmojiPickerPanel onSelect={pick} />
        </Suspense>
      </Popover>

      {/* Every reaction and everyone who left it. */}
      <Popover
        anchor={appliedEl}
        open={panel === "details"}
        onClose={close}
        placement="bottom"
        align="end"
        className="ReactionDetails"
        role="dialog"
        aria-label="Reactions"
      >
        <div className="ReactionDetails__title">reactions</div>
        <ul className="ReactionDetails__list">
          {tallies.map((tally) => (
            <li key={tally.emoji} className="ReactionDetails__item">
              <span className="ReactionDetails__emoji">{tally.emoji}</span>
              <span className="ReactionDetails__count">{tally.count}</span>
              <span className="ReactionDetails__names keep-case">
                {tally.userIds
                  .map((id) => (id === viewerId ? "you" : (nameOf(id) ?? "someone")))
                  .join(", ")}
              </span>
              {interactive && tally.mine && (
                <RowButton
                  className="ReactionDetails__remove"
                  aria-label={`Remove your ${tally.emoji}`}
                  onClick={() => void toggle(tally.emoji)}
                >
                  remove
                </RowButton>
              )}
            </li>
          ))}
        </ul>
      </Popover>
    </div>
  );
};

const TooltipText = ({
  tally,
  nameOf,
  viewerId,
}: {
  tally?: ReactionSummary;
  nameOf: (id: string) => string | undefined;
  viewerId?: string;
}) =>
  tally ? (
    <span className="keep-case">
      {tally.emoji} {reactorNames(tally.userIds, nameOf, viewerId)}
    </span>
  ) : null;

export default PostReactions;
