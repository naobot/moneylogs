import cx from "classnames";
import { useTimezoneSelect, allTimezones } from "react-timezone-select";

type TimezoneSelectProps = {
  label: string;
  value: string | undefined;
  onChange: (timezone: string) => void;
  disabled?: boolean;
};

/** A labelled IANA timezone picker in the ControlledInput frame; warns while unset. */
export const TimezoneSelect = ({ label, value, onChange, disabled }: TimezoneSelectProps) => {
  const { options } = useTimezoneSelect({
    labelStyle: "original",
    timezones: allTimezones,
  });

  return (
    <div className={cx("ControlledInput", { "ControlledInput--warning": !value })}>
      <label>{label}</label>
      <select
        onChange={(e) => onChange(e.currentTarget.value)}
        value={value ?? ""}
        disabled={disabled}
      >
        {!value && <option value="">Choose a timezone</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TimezoneSelect;
