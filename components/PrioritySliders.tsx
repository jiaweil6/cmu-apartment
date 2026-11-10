import type { CSSProperties } from "react";
import { CRITERIA } from "@/lib/options";
import type { Priorities } from "@/lib/ranking";
import type { Criterion } from "@/lib/types";

interface Props {
  priorities: Priorities;
  /** Each slider as a share of the total, shown beside it on small screens (where the summary is hidden). */
  shares: Priorities;
  onChange: (criterion: Criterion, value: number) => void;
}

export default function PrioritySliders({ priorities, shares, onChange }: Props) {
  return (
    <div className="slider-grid">
      {CRITERIA.map(({ key, inputId, label, description }) => {
        const value = priorities[key];
        return (
          <div className="priority-slider" key={key}>
            <div className="slider-head">
              <label htmlFor={inputId}>{label}</label>
              <span className={`slider-share${value > 0 ? " is-active" : ""}`}>{shares[key]}%</span>
            </div>
            <p className="slider-hint" id={`${inputId}-hint`}>
              {description}
            </p>
            <input
              type="range"
              className="slider"
              id={inputId}
              min={0}
              max={100}
              value={value}
              aria-describedby={`${inputId}-hint`}
              onChange={(event) => onChange(key, Number(event.target.value))}
              style={{ "--value": value } as CSSProperties}
            />
          </div>
        );
      })}
    </div>
  );
}
