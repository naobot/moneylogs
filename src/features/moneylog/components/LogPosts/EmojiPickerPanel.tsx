import cx from "classnames";
import { EmojiPicker } from "frimousse";

type EmojiPickerPanelProps = {
  onSelect: (emoji: string) => void;
};

// Focusing the search on touch screens would pop the keyboard over the palette.
const hasHover = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover)").matches;

/**
 * The full emoji picker (frimousse: headless, so every part is styled from our tokens in
 * PostReactions.scss). Loaded lazily by PostReactions so it stays out of the main bundle.
 * Emoji data is fetched from the emojibase CDN on first open and cached by the browser.
 */
const EmojiPickerPanel = ({ onSelect }: EmojiPickerPanelProps) => (
  <EmojiPicker.Root
    className="EmojiPicker"
    columns={8}
    onEmojiSelect={({ emoji }) => onSelect(emoji)}
  >
    <EmojiPicker.Search
      className="EmojiPicker__search LineInput"
      placeholder="search emoji"
      autoFocus={hasHover()}
    />
    <EmojiPicker.Viewport className="EmojiPicker__viewport">
      <EmojiPicker.Loading className="EmojiPicker__status">loading…</EmojiPicker.Loading>
      <EmojiPicker.Empty className="EmojiPicker__status">no emoji found</EmojiPicker.Empty>
      <EmojiPicker.List
        className="EmojiPicker__list"
        components={{
          CategoryHeader: ({ category, ...props }) => (
            <div className="EmojiPicker__category" {...props}>
              {category.label}
            </div>
          ),
          Row: ({ children, ...props }) => (
            <div className="EmojiPicker__row" {...props}>
              {children}
            </div>
          ),
          Emoji: ({ emoji, ...props }) => (
            <button
              className={cx("EmojiPicker__emoji", { "EmojiPicker__emoji--active": emoji.isActive })}
              aria-label={emoji.label}
              {...props}
            >
              {emoji.emoji}
            </button>
          ),
        }}
      />
    </EmojiPicker.Viewport>
  </EmojiPicker.Root>
);

export default EmojiPickerPanel;
