import { Currency } from "@/types/user";
import { CURRENCIES } from "@/utils/currency";

type CurrencySelectProps = {
  id: string;
  label: string;
  value: Currency;
  onChange: (currency: Currency) => void;
  disabled?: boolean;
};

/** A labelled currency picker in the ControlledInput frame, over the shared CURRENCIES list. */
export const CurrencySelect = ({ id, label, value, onChange, disabled }: CurrencySelectProps) => (
  <div className="ControlledInput">
    <div className="ControlledInput__input">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as Currency)}
      >
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  </div>
);

export default CurrencySelect;
