import cx from "classnames";
import { LoadingDots } from "@/components/LoadingDots";
import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";

import { usePlaceIndex } from "@/hooks/usePlaceIndex";
import { buildPlaceIndex, Place, placeDetail, placeLabel, searchPlaces } from "@/utils/citySearch";
import dayjs from "@/utils/configuredDayjs";
import { useDateFormat } from "@/utils/dateFormat";
import { utcOffsetLabel } from "@/utils/timezone";

import "./PlacePicker.scss";

type PlacePickerProps = {
  label: string;
  /** The IANA zone currently chosen. */
  timezone: string | null | undefined;
  /** How the chosen place reads ("Kyoto, Japan"); the zone id is shown when there's none. */
  place?: string | null;
  onChange: (place: Place) => void;
  placeholder?: string;
  /** Single line with no "there now" footer, for the post editor. */
  compact?: boolean;
  autoFocus?: boolean;
};

type Option = { place: Place; label: string; detail: string };

const EMPTY_INDEX = buildPlaceIndex({ v: 1, tz: [], regions: [], countries: {}, rows: [] });

const guessZone = (): string | null => {
  try {
    return dayjs.tz.guess() || null;
  } catch {
    return null;
  }
};

/**
 * Type a city, pick it from a short list, and its timezone comes with it. Bare IANA zone
 * names also match, for towns too small for the list. Unset shows the warning frame.
 */
export const PlacePicker = ({
  label,
  timezone,
  place,
  onChange,
  placeholder = "Type your city",
  compact,
  autoFocus,
}: PlacePickerProps) => {
  const { status, index } = usePlaceIndex();
  const { formatTime } = useDateFormat();
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const rootRef = useRef<HTMLDivElement>(null);

  // The input shows the chosen place until the user types; `draft` is what they typed.
  const shown = place || timezone || "";
  const [draft, setDraft] = useState<string | null>(null);
  const query = draft ?? shown;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Clock for the local times shown; refreshed whenever the picker is focused or used.
  const [now, setNow] = useState(() => Date.now());

  const close = () => {
    setOpen(false);
    setDraft(null);
  };

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setDraft(null);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const typed = draft !== null && draft !== shown;
  const options: Option[] = useMemo(() => {
    if (!typed || !query.trim()) {
      // Before typing, offer this device's zone when it isn't the chosen one already.
      const device = guessZone();
      return device && device !== timezone
        ? [
            {
              place: { kind: "zone", name: device, timezone: device },
              label: "Use this device's timezone",
              detail: device,
            },
          ]
        : [];
    }
    return searchPlaces(index ?? EMPTY_INDEX, query).map((p) => ({
      place: p,
      label: placeLabel(p),
      detail: placeDetail(p),
    }));
  }, [typed, query, index, timezone]);

  const zoneTime = (tz: string) => {
    try {
      return `${utcOffsetLabel(tz, now)} · ${formatTime(dayjs(now).tz(tz))}`;
    } catch {
      return "";
    }
  };

  const pick = (option: Option) => {
    onChange(option.place);
    setNow(Date.now());
    // The parent's new place/timezone flows back in through `shown`.
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (!options.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
    } else if (e.key === "Enter") {
      if (open && options[active]) {
        e.preventDefault();
        pick(options[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      }
    } else if (e.key === "Tab") {
      close();
    }
  };

  const searching = typed && !!query.trim();
  const showList = open && (options.length > 0 || searching);

  return (
    <div
      ref={rootRef}
      className={cx("ControlledInput", "PlacePicker", {
        "ControlledInput--warning": !timezone,
        "PlacePicker--compact": compact,
      })}
    >
      <div className="ControlledInput__input PlacePicker__field">
        <label htmlFor={inputId}>{label}</label>
        <div className="PlacePicker__combo">
          <input
            id={inputId}
            className="keep-case"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={listId}
            aria-activedescendant={showList && options[active] ? `${id}-opt-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            autoFocus={autoFocus}
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setDraft(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={(e) => {
              e.currentTarget.select();
              setNow(Date.now());
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
          />
          {showList && (
            <ul id={listId} role="listbox" className="PlacePicker__list">
              {searching && status === "loading" && (
                <li className="PlacePicker__status" role="presentation">
                  loading places
                  <LoadingDots label="" />
                </li>
              )}
              {options.map((option, i) => (
                <li
                  key={`${option.place.kind}-${option.label}-${option.detail}-${i}`}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={cx("PlacePicker__option", {
                    "PlacePicker__option--active": i === active,
                  })}
                  // mousedown, not click, so the input doesn't blur and close the list first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(option);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className="PlacePicker__optionText">
                    <span className="PlacePicker__optionName keep-case">{option.label}</span>
                    <span className="PlacePicker__optionDetail keep-case">{option.detail}</span>
                  </span>
                  <span className="PlacePicker__optionTime">{zoneTime(option.place.timezone)}</span>
                </li>
              ))}
              {searching && status !== "loading" && !options.length && (
                <li className="PlacePicker__status" role="presentation">
                  no matches. try a bigger city nearby, or a timezone like Europe/Paris
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
      {!compact && (
        <p className="PlacePicker__zone">
          {timezone ? (
            <>
              <span className="keep-case">{timezone}</span> · {zoneTime(timezone)} there now
            </>
          ) : (
            "pick a place to set your timezone"
          )}
        </p>
      )}
    </div>
  );
};

export default PlacePicker;
