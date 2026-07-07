import cx from "classnames";

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  ariaLabel?: string;
}

// Filing-folder style tabs that peek up out of the top border of the box below.
// Pair with a `.Window` sibling directly beneath it.
const Tabs = ({ tabs, activeId, onChange, className, ariaLabel }: TabsProps) => {
  return (
    <div className={cx("Tabs", className)} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cx("Tabs__tab", { "Tabs__tab--active": isActive })}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
