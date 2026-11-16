import { useMemo } from "react";
import cx from "classnames";

import {
  AVATAR_SIZE,
  avatarInitial,
  initialAvatarGrid,
  MINI_AVATAR_SIZE,
  miniAvatar,
  normaliseAvatar,
} from "@/utils/avatar";
import { pixelPath } from "@/utils/pixelArt";

import "./Avatar.scss";

type AvatarProps = {
  /** Stored 30×30 grid; anything else falls back to the name's initial. */
  avatar?: readonly string[] | null;
  /** Whose avatar: used for the label and the fallback initial. */
  name?: string | null;
  /**
   * 30 or 60: the 30-grid at 1× or 2×. 15: the mini avatar, a 15×15 shrink of the grid
   * at 1×. All whole multiples, so pixels stay crisp.
   */
  size?: 15 | 30 | 60;
  className?: string;
};

/**
 * A user's pixel avatar in the current ink (night shift included). With none drawn it
 * shows their initial in the pixel font inside a frame, or as plain text when the
 * pixel font has no glyph for it.
 */
export const Avatar = ({ avatar, name, size = 30, className }: AvatarProps) => {
  const drawn = normaliseAvatar(avatar);
  const fallback = useMemo(() => (drawn ? null : initialAvatarGrid(name)), [drawn, name]);
  const full = drawn ?? fallback;
  const mini = size === MINI_AVATAR_SIZE;
  const d = useMemo(() => (full ? pixelPath(mini ? miniAvatar(full) : full) : ""), [full, mini]);
  const gridSize = mini ? MINI_AVATAR_SIZE : AVATAR_SIZE;
  const label = name ? `${name}'s avatar` : "avatar";

  if (!full) {
    return (
      <span
        className={cx("Avatar", "Avatar--empty", `Avatar--${size}`, className)}
        role="img"
        aria-label={label}
      >
        <span aria-hidden>{avatarInitial(name)}</span>
      </span>
    );
  }

  return (
    <svg
      className={cx("Avatar", `Avatar--${size}`, { "Avatar--initial": !drawn }, className)}
      viewBox={`0 0 ${gridSize} ${gridSize}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      fill="currentColor"
      role="img"
      aria-label={label}
    >
      <path d={d} />
    </svg>
  );
};

export default Avatar;
