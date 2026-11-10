import { CRITERIA } from "@/lib/options";
import type { Priorities } from "@/lib/ranking";
import type { Criterion } from "@/lib/types";

interface Props {
  priorities: Priorities;
  onChange: (criterion: Criterion, value: number) => void;
}

/** Two sliders per row, in CRITERIA order. */
const rows = CRITERIA.reduce<(typeof CRITERIA)[]>((acc, criterion, index) => {
  if (index % 2 === 0) acc.push([]);
  acc[acc.length - 1].push(criterion);
  return acc;
}, []);

export default function PrioritySliders({ priorities, onChange }: Props) {
  return rows.map((row) => (
    <div className="row" key={row[0].key}>
      {row.map(({ key, inputId, label, description }) => {
        const value = priorities[key];
        return (
          <div className="col-6 col-md-6" key={key}>
            <div className="priority-slider">
              <label htmlFor={inputId}>{label}</label>
              <p className="sliderText">{description}</p>
              <div className="range">
                <input
                  type="range"
                  className="slider"
                  id={inputId}
                  min={0}
                  max={100}
                  value={value}
                  onChange={(event) => onChange(key, Number(event.target.value))}
                  style={{ background: `linear-gradient(to right, var(--accent) ${value}%, #ccc ${value}%)` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  ));
}
