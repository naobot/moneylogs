import { ReactNode, useId } from "react";
import { useDisclosure } from "@/hooks/useDisclosure";
import "./Disclosure.scss";

type DisclosureProps = {
  /** What's folded away (lowercase copy): "breakdown", "scheduled payments". */
  title: ReactNode;
  /** A muted count or note at the right: "3", "4 categories". */
  note?: ReactNode;
  /** Remembers the open state on this device under this id. */
  id?: string;
  /** Open until the person folds it (a wide screen may start the breakdown open). */
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * A secondary block that starts folded (2026-11 audit: quiet by default, more on
 * request). `[+] title` opens it; opened, it reads `[-] title` and its content hangs off
 * a dotted rule. Unframed: it's a way into more, not a box of its own.
 */
const Disclosure = ({
  title,
  note,
  id,
  defaultOpen = false,
  children,
  className,
}: DisclosureProps) => {
  const [open, toggle] = useDisclosure(id, defaultOpen);
  const contentId = useId();
  return (
    <div className={["Disclosure", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="Disclosure__toggle"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={toggle}
      >
        <span className="Disclosure__title">
          <span className="Disclosure__mark" aria-hidden="true">
            {open ? "[-]" : "[+]"}
          </span>{" "}
          {title}
        </span>
        {note !== undefined && note !== null && <span className="Disclosure__note">{note}</span>}
      </button>
      <div id={contentId} className="Disclosure__content" hidden={!open}>
        {open && children}
      </div>
    </div>
  );
};

export default Disclosure;
