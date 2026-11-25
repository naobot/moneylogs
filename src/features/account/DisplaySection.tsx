import Markdown from "@/components/Markdown";

import Button from "@/components/Button";
import dayjs from "@/utils/configuredDayjs";
import { formatShortDate, formatTime, useDateFormat } from "@/utils/dateFormat";
import { track } from "@/utils/analytics";
import {
  CHART_COLOURS,
  ChartColours,
  CLOCKS,
  DATE_ORDERS,
  DisplayPrefs,
  ENTRY_ALIGNS,
  ENTRY_SIZES,
  EntryAlign,
  EntrySize,
  setDisplayPrefs,
  UI_SIZES,
  UiSize,
} from "@/utils/displayPrefs";
import {
  ColourTheme,
  COLOUR_THEMES,
  isColourTheme,
  markdownColorMode,
  setTheme,
  Theme,
  THEME_FAMILIES,
  THEME_LABELS,
  themesInFamily,
  useLastColourTheme,
  useTheme,
} from "@/utils/theme";

import "./DisplaySection.scss";

/** One-line summary for the Display drawer, e.g. "Night shift · 12h". */
export const displaySummary = (theme: Theme, prefs: DisplayPrefs) =>
  `${THEME_LABELS[theme]} · ${prefs.clock}`;

const SIZE_LABELS: Record<EntrySize, string> = { s: "S", m: "M", l: "L", xl: "XL" };
const UI_SIZE_LABELS: Record<UiSize, string> = { s: "S", m: "M", l: "L" };
const ALIGN_LABELS: Record<EntryAlign, string> = {
  left: "Left",
  center: "Center",
  justify: "Justify",
};

const CHART_LABELS: Record<ChartColours, string> = { colour: "Colour", mono: "Mono" };

/** Sample categories for the preview bar: four chart fills and the grouped rest. */
const SAMPLE_CHART = [
  { slot: "0", name: "groceries", share: 34 },
  { slot: "1", name: "eating out", share: 24 },
  { slot: "2", name: "transport", share: 18 },
  { slot: "3", name: "home", share: 12 },
  { slot: "rest", name: "other", share: 12 },
] as const;

// A fixed, unambiguous moment (day > 12, afternoon) so every option label reads clearly.
const SAMPLE_MOMENT = dayjs("2026-11-24T14:05:00");

const SAMPLE_ENTRY = `Lunch at the night market with everyone. Split three ways, plus a round of
mango sticky rice that nobody regretted.`;

type SegmentedProps<T extends string> = {
  label: string;
  options: readonly T[];
  /** null when no option is the current one. */
  value: T | null;
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
          variant="toggle"
          size="sm"
          isSelected={value === option}
          onClick={() => onChange(option)}
        />
      ))}
    </div>
  </div>
);

/**
 * The colour themes as swatches, grouped by family. Each swatch wears its own theme
 * (data-theme scopes that theme's inks to the swatch), so it previews the real pair.
 */
const ColourSwatches = ({
  value,
  onChange,
}: {
  value: ColourTheme | null;
  onChange: (theme: ColourTheme) => void;
}) => (
  <div className="DisplaySection__row DisplaySection__row--top">
    <span className="DisplaySection__label">Colour</span>
    <div className="ThemeSwatches" role="group" aria-label="Colour">
      {THEME_FAMILIES.map((family) => (
        <div key={family} className="ThemeSwatches__family">
          <span className="ThemeSwatches__family-name">{family}</span>
          <div className="ThemeSwatches__grid">
            {themesInFamily(family).map((id) => (
              <button
                key={id}
                type="button"
                className={`ThemeSwatch${value === id ? " ThemeSwatch--active" : ""}`}
                aria-pressed={value === id}
                onClick={() => onChange(id)}
              >
                <span className="ThemeSwatch__chip" data-theme={id} aria-hidden="true">
                  Aa
                  <span className="ThemeSwatch__palette">
                    {[1, 2, 3, 4].map((n) => (
                      <span key={n} style={{ background: `var(--chart-${n})` }} />
                    ))}
                  </span>
                </span>
                <span className="ThemeSwatch__label">{THEME_LABELS[id]}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Viewing preferences remembered on this device: theme (Paper, the last colour theme as
 * a star, or Night shift, plus a row picking the colour theme), whether charts use the
 * theme's colours or 1-bit textures, how dates and times read, how much room the UI takes,
 * and the size and alignment of entry text. A sample entry and chart show the result live.
 */
export const DisplaySection = () => {
  const theme = useTheme();
  const lastColour = useLastColourTheme();
  const starTheme = lastColour ?? COLOUR_THEMES[0];
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
            variant="toggle"
            size="sm"
            isSelected={theme === "paper"}
            onClick={() => setTheme("paper")}
          />
          <Button
            text={lastColour ? THEME_LABELS[lastColour] : "Colour"}
            icon="star"
            variant="toggle"
            size="sm"
            isSelected={isColourTheme(theme)}
            onClick={() => setTheme(starTheme)}
          />
          <Button
            text={THEME_LABELS.night}
            icon="moon"
            variant="toggle"
            size="sm"
            isSelected={theme === "night"}
            onClick={() => setTheme("night")}
          />
        </div>
      </div>

      <ColourSwatches value={isColourTheme(theme) ? theme : null} onChange={setTheme} />
      <Segmented
        label="Charts"
        options={CHART_COLOURS}
        value={prefs.charts}
        labelFor={(charts) => CHART_LABELS[charts]}
        onChange={(charts) => {
          if (charts === prefs.charts) return;
          setDisplayPrefs({ charts });
          track("chart_colours", { charts });
        }}
      />
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
        label="UI size"
        options={UI_SIZES}
        value={prefs.uiSize}
        labelFor={(size) => UI_SIZE_LABELS[size]}
        onChange={(uiSize) => {
          if (uiSize === prefs.uiSize) return;
          setDisplayPrefs({ uiSize });
          track("ui_size", { size: uiSize });
        }}
      />
      <Segmented
        label="Entry text"
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
      <p className="DisplaySection__hint">
        UI size sets the room around things: padding, rows and buttons. Entry text sets the size of
        what you wrote.
      </p>

      <div className="DisplaySample" aria-label="Preview">
        <div className="DisplaySample__meta">{formatDate(now)}</div>
        <div data-color-mode={markdownColorMode(theme)}>
          <Markdown source={SAMPLE_ENTRY} />
        </div>
        <div className="DisplaySample__chart">
          <span className="DisplaySample__bar" role="img" aria-label="Sample chart">
            {SAMPLE_CHART.map((c) => (
              <span
                key={c.slot}
                className={`chart-fill-${c.slot}`}
                style={{ width: `${c.share}%` }}
              />
            ))}
          </span>
          <ul className="DisplaySample__key" aria-hidden="true">
            {SAMPLE_CHART.map((c) => (
              <li key={c.slot}>
                <span className={`DisplaySample__swatch chart-fill-${c.slot}`} />
                {c.name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="DisplaySection__hint">Saved on this device only.</p>
    </>
  );
};

export default DisplaySection;
