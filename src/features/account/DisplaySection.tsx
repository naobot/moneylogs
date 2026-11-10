import MDEditor from "@uiw/react-md-editor";

import Button from "@/components/Button";
import dayjs from "@/utils/configuredDayjs";
import { formatShortDate, formatTime, useDateFormat } from "@/utils/dateFormat";
import {
  CLOCKS,
  DATE_ORDERS,
  DisplayPrefs,
  ENTRY_ALIGNS,
  ENTRY_SIZES,
  EntryAlign,
  EntrySize,
  setDisplayPrefs,
} from "@/utils/displayPrefs";
import { markdownColorMode, setTheme, Theme, useTheme } from "@/utils/theme";

export const THEME_LABELS: Record<Theme, string> = {
  paper: "Paper",
  night: "Night shift",
};

/** One-line summary for the Display drawer, e.g. "Night shift · 12h". */
export const displaySummary = (theme: Theme, prefs: DisplayPrefs) =>
  `${THEME_LABELS[theme]} · ${prefs.clock}`;

const SIZE_LABELS: Record<EntrySize, string> = { s: "S", m: "M", l: "L", xl: "XL" };
const ALIGN_LABELS: Record<EntryAlign, string> = {
  left: "Left",
  center: "Center",
  justify: "Justify",
};

// A fixed, unambiguous moment (day > 12, afternoon) so every option label reads clearly.
const SAMPLE_MOMENT = dayjs("2026-11-24T14:05:00");

const SAMPLE_ENTRY = `Lunch at the night market with everyone. Split three ways, plus a round of
mango sticky rice that nobody regretted.`;

type SegmentedProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T;
  labelFor: (option: T) => string;
  onChange: (option: T) => void;
};

const Segmented = <T extends string>({
  label,
  options,
  value,
  labelFor,
  onChange,
}: SegmentedProps<T>) => (
  <div className="DisplaySection__row">
    <span className="DisplaySection__label">{label}</span>
    <div className="Segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <Button
          key={option}
          text={labelFor(option)}
          buttonStyle="primary-border-lite"
          isSelected={value === option}
          onClick={() => onChange(option)}
        />
      ))}
    </div>
  </div>
);

/**
 * Viewing preferences remembered on this device: theme (Paper or Night shift), how dates
 * and times read, and the size and alignment of entry text. A sample entry shows the
 * result live.
 */
export const DisplaySection = () => {
  const theme = useTheme();
  const { prefs, formatDate } = useDateFormat();
  const now = dayjs();

  return (
    <>
      <div className="DisplaySection__row">
        <span className="DisplaySection__label">Theme</span>
        <div className="Segmented" role="group" aria-label="Theme">
          <Button
            text={THEME_LABELS.paper}
            icon="sun"
            buttonStyle="primary-border-lite"
            isSelected={theme === "paper"}
            onClick={() => setTheme("paper")}
          />
          <Button
            text={THEME_LABELS.night}
            icon="moon"
            buttonStyle="primary-border-lite"
            isSelected={theme === "night"}
            onClick={() => setTheme("night")}
          />
        </div>
      </div>

      <Segmented
        label="Clock"
        options={CLOCKS}
        value={prefs.clock}
        labelFor={(clock) => formatTime(SAMPLE_MOMENT, { ...prefs, clock })}
        onChange={(clock) => setDisplayPrefs({ clock })}
      />
      <Segmented
        label="Dates"
        options={DATE_ORDERS}
        value={prefs.dateOrder}
        labelFor={(dateOrder) => formatShortDate(SAMPLE_MOMENT, { ...prefs, dateOrder })}
        onChange={(dateOrder) => setDisplayPrefs({ dateOrder })}
      />
      <Segmented
        label="Entry size"
        options={ENTRY_SIZES}
        value={prefs.entrySize}
        labelFor={(size) => SIZE_LABELS[size]}
        onChange={(entrySize) => setDisplayPrefs({ entrySize })}
      />
      <Segmented
        label="Entry align"
        options={ENTRY_ALIGNS}
        value={prefs.entryAlign}
        labelFor={(align) => ALIGN_LABELS[align]}
        onChange={(entryAlign) => setDisplayPrefs({ entryAlign })}
      />

      <div className="DisplaySample" aria-label="Preview">
        <div className="DisplaySample__meta">{formatDate(now)}</div>
        <div data-color-mode={markdownColorMode(theme)}>
          <MDEditor.Markdown source={SAMPLE_ENTRY} />
        </div>
      </div>

      <p className="DisplaySection__hint">Saved on this device only.</p>
    </>
  );
};

export default DisplaySection;
