import { CRITERIA } from "@/lib/options";
import { priorityShares, type Priorities } from "@/lib/ranking";

/** The "Your Priorities" bars: each slider as a share of the total. */
export default function PrioritySummary({ priorities }: { priorities: Priorities }) {
  const shares = priorityShares(priorities);

  return (
    <div className="list-group">
      {CRITERIA.map(({ key, label }) => {
        const activeClass = priorities[key] > 0 ? " is-active" : "";
        return (
          <div className="priority-item" key={key}>
            <div className={`priority-label${activeClass}`}>{label}</div>
            <div className="percentage-bar-container">
              <div className="percentage-bar" style={{ width: `${shares[key]}%` }} />
            </div>
            <span className={`percentage${activeClass}`}>{shares[key]}%</span>
          </div>
        );
      })}
    </div>
  );
}
