import { formatClock, miles, modeName, tidyName, wholeMinutes } from "@/lib/route-format";
import type { ApartmentRoutes, RouteLeg } from "@/lib/schemas";
import { Bus, Walk } from "./icons";

type Commute = NonNullable<ApartmentRoutes["commute"]>;

interface Props {
  commute: Commute;
  /** Where the trip starts, e.g. "Coda on Centre". */
  from: string;
  /** Where it ends, e.g. "Carnegie Mellon". */
  to: string;
}

const lineName = (leg: RouteLeg) => leg.route?.shortName ?? modeName(leg.mode);

/**
 * The commute as steps, drawn like the map: a dotted rail for walking, a solid one
 * for rides, an open dot where you leave and a filled one where you arrive.
 */
export default function CommuteSteps({ commute, from, to }: Props) {
  const last = commute.legs.length - 1;
  return (
    <ol className="steps">
      <li className="step step-point">
        <span className="step-time">{formatClock(commute.departAt)}</span>
        <span className="step-text">Leave {from}</span>
      </li>
      {commute.legs.map((leg, index) =>
        leg.mode === "WALK" ? (
          <li key={index} className="step step-walk">
            <span className="step-time" />
            <span className="step-text">
              <Walk className="step-icon" />
              Walk {wholeMinutes(leg.minutes)} min to {index === last ? to : tidyName(leg.to.name)}
              <span className="step-meta">{miles(leg.meters)}</span>
            </span>
          </li>
        ) : (
          <li key={index} className="step step-ride">
            <span className="step-time">{formatClock(leg.departAt)}</span>
            <span className="step-text">
              Take the{" "}
              <span className="route-badge">
                <Bus />
                {lineName(leg)}
              </span>{" "}
              {modeName(leg.mode).toLowerCase()} from {tidyName(leg.from.name)}
              <span className="step-meta">
                {leg.headsign && <>{tidyName(leg.headsign)} · </>}
                {leg.stops} {leg.stops === 1 ? "stop" : "stops"}, {wholeMinutes(leg.minutes)} min
              </span>
              <span className="step-meta">
                Get off at {tidyName(leg.to.name)}, {formatClock(leg.arriveAt)}
              </span>
            </span>
          </li>
        ),
      )}
      <li className="step step-point is-end">
        <span className="step-time">{formatClock(commute.arriveAt)}</span>
        <span className="step-text">Arrive at {to}</span>
      </li>
    </ol>
  );
}

/** One line for small screens: "Walk 4 min → 71B → Walk 6 min". */
export function CommuteSummary({ commute }: { commute: Commute }) {
  return (
    <span className="route-summary">
      {commute.legs.map((leg, index) => (
        <span key={index} className="route-summary-part">
          {index > 0 && (
            <span className="route-summary-arrow" aria-hidden="true">
              →
            </span>
          )}
          {leg.mode === "WALK" ? (
            <span className="route-summary-walk">
              <Walk className="meta-icon" />
              {wholeMinutes(leg.minutes)} min
            </span>
          ) : (
            <span className="route-badge">
              <Bus />
              {lineName(leg)}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
