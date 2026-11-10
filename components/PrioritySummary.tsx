import { CRITERIA } from "@/lib/options";
import type { Priorities } from "@/lib/ranking";

/** The "Your Priorities" bars: each slider as a share of the total. */
export default function PrioritySummary({ priorities, shares }: { priorities: Priorities; shares: Priorities }) {
  return (
    <ul className="priority-summary">
      {CRITERIA.map(({ key, label }) => {
        const activeClass = priorities[key] > 0 ? " is-active" : "";
        return (
          <li className={`priority-item${activeClass}`} key={key}>
            <span className="priority-label">{label}</span>
            <span className="percentage-bar-container" aria-hidden="true">
              <span className="percentage-bar" style={{ width: `${shares[key]}%` }} />
            </span>
            <span className="percentage">{shares[key]}%</span>
          </li>
        );
      })}
    </ul>
  );
}
