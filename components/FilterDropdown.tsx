interface Props<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}

/** A checkbox list that opens on hover (or keyboard focus). */
export default function FilterDropdown<T extends string>({ label, options, selected, onToggle }: Props<T>) {
  return (
    <div className="dropdown">
      <button type="button" className="dropbtn">
        {label}
      </button>
      <div className="dropdown-content">
        {options.map((option) => (
          <div key={option.value}>
            <label>
              <input
                type="checkbox"
                value={option.value}
                checked={selected.includes(option.value)}
                onChange={() => onToggle(option.value)}
              />{" "}
              {option.label}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
