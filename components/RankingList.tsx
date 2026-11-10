"use client";

import { useState } from "react";
import type { RankedApartment } from "@/lib/ranking";
import ApartmentCard from "./ApartmentCard";

interface Props {
  ranked: RankedApartment[];
  hasPriorities: boolean;
}

export default function RankingList({ ranked, hasPriorities }: Props) {
  // One card open at a time.
  const [openId, setOpenId] = useState<string | null>(null);

  let content;
  if (!hasPriorities) {
    content = <h2 className="warning">Select Your Priorities for Your Dream Off-Campus Residence!</h2>;
  } else if (ranked.length === 0) {
    content = <p className="empty-message">No apartments match your filters for this room type.</p>;
  } else {
    content = ranked.map(({ apartment }, index) => (
      <ApartmentCard
        key={apartment.id}
        apartment={apartment}
        rank={index + 1}
        isOpen={openId === apartment.id}
        onToggle={() => setOpenId((current) => (current === apartment.id ? null : apartment.id))}
      />
    ));
  }

  return <div id="rankingsList">{content}</div>;
}
