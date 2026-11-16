import { useMemo } from "react";
import cx from "classnames";

import { AVATAR_SIZE, avatarInitial, initialAvatarGrid, normaliseAvatar } from "@/utils/avatar";
import { pixelPath } from "@/utils/pixelArt";

import "./Avatar.scss";

type AvatarProps = {
  /** Stored 30×30 grid; anything else falls back to the name's initial. */
  avatar?: readonly string[] | null;
  /** Whose avatar: used for the label and the fallback initial. */
  name?: string | null;
  /** Whole multiples of the 30-grid only, so pixels stay crisp. */
  size?: 30 | 60;
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
  const grid = drawn ?? fallback;
  const d = useMemo(() => (grid ? pixelPath(grid) : ""), [grid]);
  const label = name ? `${name}'s avatar` : "avatar";

  if (!grid) {
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
      viewBox={`0 0 ${AVATAR_SIZE} ${AVATAR_SIZE}`}
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
