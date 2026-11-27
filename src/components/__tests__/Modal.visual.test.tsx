import { describe, it, expect } from "vite-plus/test";
import { act } from "react";
import Modal from "@/components/Modal";
import { PHONE, useVisualHarness } from "@/test/visual";

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

  it("renders a tool modal with one action, which fills the footer on phones", async () => {
    v.render(
      <Modal isOpen onClose={() => {}}>
        <Modal.Header title="manage log" showCloseButton />
        <Modal.Body>Rename the log, reorder members, or edit categories.</Modal.Body>
        <Modal.Actions>
          <Modal.ConfirmButton text="Done" />
        </Modal.Actions>
      </Modal>,
    );

    await v.sizes("tool modal");
  });

  it("pins the header and footer of a tall sheet while its body scrolls", async () => {
    v.render(
      <Modal isOpen onClose={() => {}}>
        <Modal.Header
          title={<span className="keep-case">categories for Alice + Bob home</span>}
          showCloseButton
        />
        <Modal.Body>
          {Array.from({ length: 30 }, (_, i) => (
            <p key={i}>category {i + 1}</p>
          ))}
        </Modal.Body>
        <Modal.Actions>
          <Modal.CancelButton text="Back" />
          <Modal.ConfirmButton text="Next" />
        </Modal.Actions>
      </Modal>,
    );
    await v.viewport(PHONE);
    await v.settled();
    const content = document.querySelector<HTMLElement>(".Modal__content")!;
    const header = content.querySelector<HTMLElement>(".Modal__header")!;
    const footer = content.querySelector<HTMLElement>(".Modal__footer")!;
    const box = content.getBoundingClientRect();

    // A sheet: full width, docked to the bottom, no taller than 90% of the screen.
    expect(box.width).toBe(PHONE.width);
    expect(Math.round(box.bottom)).toBe(PHONE.height);
    expect(box.height).toBeLessThanOrEqual(PHONE.height * 0.9 + 1);

    // Back sits at the left; the main action fills the rest.
    const [back, next] = Array.from(footer.querySelectorAll<HTMLElement>(".Button"));
    expect(back.getBoundingClientRect().width).toBeLessThan(next.getBoundingClientRect().width);
    expect(next.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);

    // Scrolled to the end, the header and footer are still where they were.
    const headerTop = header.getBoundingClientRect().top;
    const footerTop = footer.getBoundingClientRect().top;
    act(() => {
      content.scrollTop = content.scrollHeight;
    });
    await new Promise((r) => requestAnimationFrame(r));
    expect(content.scrollTop).toBeGreaterThan(0);
    expect(header.getBoundingClientRect().top).toBeCloseTo(headerTop, 0);
    expect(footer.getBoundingClientRect().top).toBeCloseTo(footerTop, 0);
    await v.snapshot("tall sheet, scrolled");
  });

  it("is a 450px box with right-aligned actions on wide screens", async () => {
    await v.viewport({ width: 1440, height: 900 });
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
    await v.settled();
    const content = document.querySelector<HTMLElement>(".Modal__content")!;
    expect(content.getBoundingClientRect().width).toBe(450);
    const footer = content.querySelector<HTMLElement>(".Modal__footer")!.getBoundingClientRect();
    const archive = content
      .querySelector<HTMLElement>(".Modal__button--confirm")!
      .getBoundingClientRect();
    expect(footer.right - archive.right).toBeCloseTo(16, 0);
    await v.snapshot("modal · wide");
  });

  it("themes the sheet in night shift", async () => {
    v.night();
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
    await v.snapshot("modal · night");
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
