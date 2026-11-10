"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NO_PRIORITIES, hasPriorities, priorityShares, rankApartments, type NeighborhoodFilter } from "@/lib/ranking";
import type { Amenity, Apartment, Criterion, LatLng, RoomType, StudentType } from "@/lib/types";
import { AMENITY_OPTIONS, NEIGHBORHOOD_OPTIONS, OPENINGS_OPTION } from "@/lib/options";
import AboutYou from "./AboutYou";
import FilterDropdown from "./FilterDropdown";
import { ArrowDown } from "./icons";
import PrioritySliders from "./PrioritySliders";
import PrioritySummary from "./PrioritySummary";
import RankingList from "./RankingList";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function ApartmentFinder({ apartments, campus }: { apartments: Apartment[]; campus: LatLng }) {
  const [priorities, setPriorities] = useState(NO_PRIORITIES);
  const [roomType, setRoomType] = useState<RoomType>("studio");
  const [studentType, setStudentType] = useState<StudentType>("undergraduate");
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodFilter[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [openingsOnly, setOpeningsOnly] = useState(false);
  // Whether the rankings are below the screen (phones show a shortcut to them).
  const [rankingsBelow, setRankingsBelow] = useState(false);
  const rankingsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const rankings = rankingsRef.current;
    if (!rankings) return;
    const observer = new IntersectionObserver(([entry]) =>
      setRankingsBelow(!entry.isIntersecting && entry.boundingClientRect.top > 0),
    );
    observer.observe(rankings);
    return () => observer.disconnect();
  }, []);

  const ranked = useMemo(
    () => rankApartments(apartments, priorities, { roomType, studentType, neighborhoods, amenities, openingsOnly }),
    [apartments, priorities, roomType, studentType, neighborhoods, amenities, openingsOnly],
  );
  const shares = priorityShares(priorities);
  const isRanking = hasPriorities(priorities);
  const countLabel = `${ranked.length} ${ranked.length === 1 ? "apartment" : "apartments"}`;

  const setPriority = (criterion: Criterion, value: number) =>
    setPriorities((current) => ({ ...current, [criterion]: value }));

  return (
    <div className="finder">
      <div className="finder-column finder-priorities">
        <section className="panel priority-summary-panel" aria-labelledby="summary-heading">
          <h2 id="summary-heading">Your priorities</h2>
          <PrioritySummary priorities={priorities} shares={shares} />
        </section>

        <section className="panel" aria-labelledby="sliders-heading">
          <h2 id="sliders-heading">What matters most to you when choosing off-campus housing?</h2>
          <p className="sliderText">Drag a slider right to make it count more</p>
          <PrioritySliders priorities={priorities} shares={shares} onChange={setPriority} />
        </section>
      </div>

      <div className="finder-column finder-results">
        <section className="panel" aria-labelledby="about-heading">
          <h2 id="about-heading">About you</h2>
          <AboutYou
            roomType={roomType}
            studentType={studentType}
            onRoomTypeChange={setRoomType}
            onStudentTypeChange={setStudentType}
          />
        </section>

        <section ref={rankingsRef} className="rankings" aria-labelledby="rankings-heading">
          <div className="rankings-head">
            <h2 id="rankings-heading">Your rankings</h2>
            <p className="result-count" aria-live="polite">
              {isRanking && countLabel}
            </p>
          </div>
          <div className="filters" role="group" aria-label="Filter rankings">
            <FilterDropdown
              label="Location"
              options={NEIGHBORHOOD_OPTIONS}
              selected={neighborhoods}
              onToggle={(value) => setNeighborhoods((current) => toggle(current, value))}
            />
            <FilterDropdown
              label="Amenities"
              options={[...AMENITY_OPTIONS, OPENINGS_OPTION]}
              selected={openingsOnly ? [...amenities, OPENINGS_OPTION.value] : amenities}
              onToggle={(value) =>
                value === OPENINGS_OPTION.value
                  ? setOpeningsOnly((current) => !current)
                  : setAmenities((current) => toggle(current, value))
              }
            />
          </div>

          <RankingList ranked={ranked} roomType={roomType} campus={campus} hasPriorities={isRanking} />
        </section>
      </div>

      {isRanking && rankingsBelow && (
        <a className="jump-to-rankings" href="#rankings-heading">
          See your rankings ({countLabel})
          <ArrowDown />
        </a>
      )}
    </div>
  );
}
