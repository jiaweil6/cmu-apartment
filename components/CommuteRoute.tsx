import type { CSSProperties } from "react";

/**
 * The site's signature: the commute drawn as a short route from the apartment
 * (open dot) to campus (filled dot). Its length grows with the minutes, so the
 * cards in a list compare at a glance. Used for the commute and nowhere else.
 */
export default function CommuteRoute({ minutes }: { minutes: number }) {
  return (
    <span className="route" style={{ "--minutes": minutes } as CSSProperties}>
      <span className="route-line" aria-hidden="true" />
      {minutes} min commute
    </span>
  );
}
