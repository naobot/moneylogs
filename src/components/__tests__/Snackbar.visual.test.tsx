import { describe, it, expect } from "vite-plus/test";
import { Snackbar } from "@/components/ToastContainer";
import { useVisualHarness } from "@/test/visual";
import type { ToastVariant } from "@/hooks/useToast";

const at = new Date("2026-11-17T09:00:00Z");

// The snackbar shows one toast at a time, centred in the viewport, so each snapshot
// holds a single card.
const toast = (message: string, variant: ToastVariant) => (
  <Snackbar toasts={[{ id: "1", message, variant, timestamp: at }]} onRemove={() => {}} />
);

const LONG =
  "Couldn't send the gift. Your friend's shelf is full, so try again after they make room.";

describe("Snackbar (visual)", () => {
  const v = useVisualHarness();

  it("renders an error toast", async () => {
    v.render(toast("Couldn't save your post. Try again.", "error"));

    expect(v.container.querySelector("[role=alert]")).not.toBeNull();
    expect(v.container.querySelector(".Snackbar__close")?.textContent).toBe("ok");
    await v.snapshot("snackbar error");
  });

  it("renders a success toast", async () => {
    v.render(toast("Log archived.", "success"));

    expect(v.container.querySelector("[role=status]")).not.toBeNull();
    await v.snapshot("snackbar success");
  });

  it("wraps a long message inside the card", async () => {
    v.render(toast(LONG, "error"));

    await v.snapshot("snackbar long message");
  });

  it("renders both variants in night shift", async () => {
    v.night();

    v.render(toast("Couldn't save your post. Try again.", "error"));
    await v.snapshot("snackbar error night");

    v.render(toast("Log archived.", "success"));
    await v.snapshot("snackbar success night");
  });
});
