// Small inline line icons: one size (16px) and one stroke (1.5), coloured by their text role.
// Decorative, so hidden from screen readers.

interface IconProps {
  className?: string;
}

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

export function ChevronDown({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ExternalLink({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function MapPin({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

export function Info({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

/** The site's mark: a house on an orange tile. */
export function BrandMark({ className }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path
        d="M9 15.5 16 9.5l7 6V23a1 1 0 0 1-1 1h-4v-5h-4v5h-4a1 1 0 0 1-1-1z"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Walk({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="13" cy="4" r="1.6" />
      <path d="m9 21 2.5-6 2.5 2v4M10.5 9.5 13 8l2.5 3.5H18M10.5 9.5 9 13M13 8l-1.5 7" />
    </svg>
  );
}

export function ArrowDown({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}

export function Close({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function Frame({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
    </svg>
  );
}
