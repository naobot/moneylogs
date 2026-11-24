import { ReactNode } from "react";
import { LoadingDots } from "@/components/LoadingDots";

import Button from "@/components/Button";
import Modal from "@/components/Modal";
import RowButton from "@/components/RowButton";

/** List and detail side by side from here up; keep in sync with $breakpoint-md. */
export const WIDE_QUERY = "(min-width: 768px)";

/**
 * The Categories and Budgets windows' body: on wide screens the list and the open
 * item's detail side by side; on phones the list, or (once a row is tapped) the
 * detail with a way back.
 */
export const ListDetail = ({
  wide,
  list,
  detail,
  listName,
  onBack,
}: {
  wide: boolean;
  list: ReactNode;
  /** The open item's detail, or null when none is open. */
  detail: ReactNode;
  /** What the back link returns to, e.g. "categories". */
  listName: string;
  onBack: () => void;
}) => {
  if (wide) {
    return (
      <div className="CategoryManager__panes">
        {list}
        <div className="CategoryManager__detailPane">{detail}</div>
      </div>
    );
  }
  if (!detail) return <>{list}</>;
  return (
    <div className="CategoryManager__detailPane">
      <RowButton
        className="CategoryManager__back"
        aria-label={`Back to ${listName}`}
        onClick={onBack}
      >
        ‹ {listName}
      </RowButton>
      {detail}
    </div>
  );
};

/** The footer of a save-as-you-go window: whether it's saving, and Done. */
export const AutosaveActions = ({
  isSaving,
  onDone,
}: {
  isSaving: boolean;
  onDone: () => void;
}) => (
  <Modal.Actions>
    <small className="CategoryManager__status" role="status">
      {isSaving ? (
        <>
          saving
          <LoadingDots label="" />
        </>
      ) : (
        "changes save automatically"
      )}
    </small>
    <Button text="Done" variant="primary" onClick={onDone} />
  </Modal.Actions>
);

export default ListDetail;
