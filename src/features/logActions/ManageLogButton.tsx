import RowButton from "@/components/RowButton";
import { ManageTarget } from "./manageTarget";

import "./LogActions.scss";

type ManageLogButtonProps = {
  target: ManageTarget;
  onManage: (target: ManageTarget) => void;
};

/** Small row button that opens the Manage modal (archive / delete) for one log. */
export const ManageLogButton = ({ target, onManage }: ManageLogButtonProps) => (
  <RowButton aria-label={`Manage ${target.title}`} onClick={() => onManage(target)}>
    manage
  </RowButton>
);

export default ManageLogButton;
