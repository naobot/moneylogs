import { Link } from "react-router-dom";

import { Ledger } from "@/types/ledger";

import "./Ledger.scss";

type LedgerListProps = {
  ledgers: Array<Ledger>;
};

export const LedgerList = ({ ledgers }: LedgerListProps) => (
  <ul className="LedgerList">
    {ledgers.map((ledger) => (
      <li key={ledger.id}>
        <Link to={`/l/${ledger.id}`}>{ledger.title}</Link>
        <small>
          {(ledger.memberUids?.length ?? 0) > 1
            ? `shared · ${ledger.memberUids.length} members`
            : "personal"}
        </small>
      </li>
    ))}
  </ul>
);

export default LedgerList;
