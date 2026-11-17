import { describe, it, expect } from "vite-plus/test";
import UpdateBanner from "@/components/UpdateBanner";
import { Snackbar } from "@/components/ToastContainer";
import { useVisualHarness } from "@/test/visual";

describe("UpdateBanner (visual)", () => {
  const v = useVisualHarness();

  it("renders the update prompt", async () => {
    v.render(<UpdateBanner onRefresh={() => {}} onDismiss={() => {}} />);

    expect(v.container.querySelector("[role=alert]")).not.toBeNull();
    await v.snapshot("update banner");
  });
});

describe("Snackbar (visual)", () => {
  const v = useVisualHarness();
  const at = new Date("2026-11-17T09:00:00Z");

  it("renders an error toast", async () => {
    v.render(
      <Snackbar
        toasts={[
          {
            id: "1",
            message: "Couldn't save your post. Try again.",
            variant: "error",
            timestamp: at,
          },
        ]}
        onRemove={() => {}}
      />,
    );

    expect(v.container.querySelector(".Snackbar__item")).not.toBeNull();
    await v.snapshot("snackbar error");
  });

  it("renders a success toast", async () => {
    v.render(
      <Snackbar
        toasts={[{ id: "2", message: "Log archived.", variant: "success", timestamp: at }]}
        onRemove={() => {}}
      />,
    );

    expect(v.container.querySelector(".Snackbar__item--success")).not.toBeNull();
    await v.snapshot("snackbar success");
  });
});
