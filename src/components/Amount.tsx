import { InputHTMLAttributes, ReactNode } from "react";
import { Currency } from "@/types/user";
import { CURRENCIES } from "@/utils/currency";
import { FieldFrame } from "./Field";

type AmountProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "className" | "type" | "value" | "onChange"
> & {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  currency: Currency;
  /** Lets the person pick the currency in the prefix cell; without it, the cell is fixed. */
  onCurrencyChange?: (currency: Currency) => void;
  currencies?: ReadonlyArray<Currency>;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
};

/**
 * An amount (2026-11 audit): a text field (dashed: you type the number) with the
 * currency as a solid prefix cell (`JPY ▾`: you choose it); the number bold,
 * right-aligned, in tabular figures.
 */
const Amount = ({
  label,
  value,
  onChange,
  currency,
  onCurrencyChange,
  currencies = CURRENCIES,
  hint,
  error,
  disabled,
  className,
  ...input
}: AmountProps) => (
  <FieldFrame label={label} hint={hint} error={error} disabled={disabled} className={className}>
    {({ inputId, describedBy }) => (
      <span className="Field__box Amount">
        {onCurrencyChange ? (
          <span className="Amount__currency Amount__currency--pick">
            <select
              className="Amount__currencySelect"
              aria-label="Currency"
              value={currency}
              disabled={disabled}
              onChange={(e) => onCurrencyChange(e.target.value as Currency)}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </span>
        ) : (
          <span className="Amount__currency">{currency}</span>
        )}
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="Field__input Amount__input"
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          {...input}
        />
      </span>
    )}
  </FieldFrame>
);

export default Amount;
