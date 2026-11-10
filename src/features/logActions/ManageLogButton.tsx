import { ManageTarget } from "./manageTarget";

import "./LogActions.scss";

type ManageLogButtonProps = {
  target: ManageTarget;
  onManage: (target: ManageTarget) => void;
};

/** Small row button that opens the Manage modal (archive / delete) for one log. */
export const ManageLogButton = ({ target, onManage }: ManageLogButtonProps) => (
  <button
    type="button"
    className="LogRowButton"
    aria-label={`Manage ${target.title}`}
    onClick={() => onManage(target)}
  >
    manage
  </button>
);

export default ManageLogButton;
