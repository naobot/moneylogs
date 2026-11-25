import { describe, it, expect } from "vite-plus/test";
import Modal from "@/components/Modal";
import { useVisualHarness } from "@/test/visual";

describe("Modal (visual)", () => {
  const v = useVisualHarness();

  it("renders a confirmation modal", async () => {
    v.render(
      <Modal isOpen onClose={() => {}}>
        <Modal.Header title="archive this log?" showCloseButton />
        <Modal.Body>Archived logs are read-only. You can still see the summary.</Modal.Body>
        <Modal.Actions>
          <Modal.CancelButton />
          <Modal.ConfirmButton text="Archive" />
        </Modal.Actions>
      </Modal>,
    );

    expect(document.querySelector(".Modal__content")).not.toBeNull();
    await v.sizes("confirmation modal");
  });

  it("renders a striped tool modal", async () => {
    v.render(
      <Modal isOpen onClose={() => {}}>
        <Modal.Header title="manage log" striped showCloseButton />
        <Modal.Body>Rename the log, reorder members, or edit categories.</Modal.Body>
        <Modal.Actions>
          <Modal.ConfirmButton text="Done" />
        </Modal.Actions>
      </Modal>,
    );

    expect(document.querySelector(".Modal__header--striped")).not.toBeNull();
    await v.sizes("striped tool modal");
  });

  it("renders disabled actions while busy", async () => {
    v.render(
      <Modal isOpen onClose={() => {}} disabled>
        <Modal.Header title="deleting…" showCloseButton />
        <Modal.Body>Please wait.</Modal.Body>
        <Modal.Actions>
          <Modal.CancelButton />
          <Modal.ConfirmButton text="Delete" />
        </Modal.Actions>
      </Modal>,
    );

    expect(document.querySelectorAll(".Modal__content button:disabled")).toHaveLength(3);
    await v.snapshot("disabled modal");
  });
});
