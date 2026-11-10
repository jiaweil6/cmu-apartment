"use client";

import { useEffect, useId, useRef, useState, type FocusEvent } from "react";
import { ChevronDown } from "./icons";

interface Props<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}

/**
 * A checkbox list. It opens on hover with a mouse, when tabbed into, or when the
 * button is clicked or tapped (touch screens have no hover). A click outside or
 * Escape closes it.
 */
export default function FilterDropdown<T extends string>({ label, options, selected, onToggle }: Props<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const count = selected.length;

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  // Close when focus moves to something else on the page (e.g. tabbing past the last option).
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next && !event.currentTarget.contains(next)) setIsOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`dropdown${count > 0 ? " has-selection" : ""}${isOpen ? " is-open" : ""}`}
      onBlur={onBlur}
    >
      <button
        type="button"
        className="dropbtn"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((current) => !current)}
      >
        {label}
        {count > 0 && (
          <span className="filter-count">
            {count}
            <span className="visually-hidden"> selected</span>
          </span>
        )}
        <ChevronDown className="dropbtn-chevron" />
      </button>
      <div id={menuId} className="dropdown-content">
        {options.map((option) => (
          <label key={option.value} className="dropdown-option">
            <input
              type="checkbox"
              value={option.value}
              checked={selected.includes(option.value)}
              onChange={() => onToggle(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}
