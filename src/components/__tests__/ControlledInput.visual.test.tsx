import { describe, it, expect } from "vite-plus/test";
import ControlledInput from "@/components/ControlledInput";
import CurrencySelect from "@/components/CurrencySelect";
import { useVisualHarness } from "@/test/visual";

describe("ControlledInput (visual)", () => {
  const v = useVisualHarness();

  it("renders input types, the error state and the currency select", async () => {
    const noop = () => {};
    v.render(
      <>
        <ControlledInput label="name" value="Kyoto trip" onChange={noop} />
        <ControlledInput label="amount" type="number" value={1200} onChange={noop} />
        <ControlledInput label="date" type="date" value="2026-11-17" onChange={noop} />
        <ControlledInput label="password" type="password" value="hunter22" onChange={noop} />
        <ControlledInput
          label="email"
          value="not-an-email"
          onChange={noop}
          isError
          errorMessage="Enter a valid email address."
        />
        <CurrencySelect id="visual-currency" label="currency" value="JPY" onChange={noop} />
        <CurrencySelect
          id="visual-currency-off"
          label="locked"
          value="USD"
          onChange={noop}
          disabled
        />
      </>,
    );

    expect(v.container.querySelectorAll(".ControlledInput")).toHaveLength(7);
    await v.snapshot("inputs and currency select");
  });
});
