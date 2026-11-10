"use client";

import { useMemo, useState } from "react";
import { NO_PRIORITIES, hasPriorities, rankApartments, type NeighborhoodFilter } from "@/lib/ranking";
import type { Amenity, Apartment, Criterion, RoomType, StudentType } from "@/lib/types";
import { AMENITY_OPTIONS, NEIGHBORHOOD_OPTIONS, OPENINGS_OPTION } from "@/lib/options";
import AboutYou from "./AboutYou";
import FilterDropdown from "./FilterDropdown";
import PrioritySliders from "./PrioritySliders";
import PrioritySummary from "./PrioritySummary";
import RankingList from "./RankingList";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function ApartmentFinder({ apartments }: { apartments: Apartment[] }) {
  const [priorities, setPriorities] = useState(NO_PRIORITIES);
  const [roomType, setRoomType] = useState<RoomType>("studio");
  const [studentType, setStudentType] = useState<StudentType>("undergraduate");
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodFilter[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [openingsOnly, setOpeningsOnly] = useState(false);

  const ranked = useMemo(
    () => rankApartments(apartments, priorities, { roomType, studentType, neighborhoods, amenities, openingsOnly }),
    [apartments, priorities, roomType, studentType, neighborhoods, amenities, openingsOnly],
  );

  const setPriority = (criterion: Criterion, value: number) =>
    setPriorities((current) => ({ ...current, [criterion]: value }));

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12 col-md-6">
          <h2>Your Priorities</h2>
          <PrioritySummary priorities={priorities} />

          <h2>What matters most to you when choosing off-campus housing?</h2>
          <p className="sliderText">
            Drag slider right to reflect your priorities.
            <br />
            <br />
          </p>
          <PrioritySliders priorities={priorities} onChange={setPriority} />
        </div>

        <div className="col-md-6">
          <h2>About You</h2>
          <AboutYou
            roomType={roomType}
            studentType={studentType}
            onRoomTypeChange={setRoomType}
            onStudentTypeChange={setStudentType}
          />

          <h2>Your Rankings</h2>
          <FilterDropdown
            label="Location"
            options={NEIGHBORHOOD_OPTIONS}
            selected={neighborhoods}
            onToggle={(value) => setNeighborhoods((current) => toggle(current, value))}
          />{" "}
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

          <RankingList ranked={ranked} hasPriorities={hasPriorities(priorities)} />
        </div>
      </div>
    </div>
  );
}
