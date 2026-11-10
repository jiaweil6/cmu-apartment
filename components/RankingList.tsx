"use client";

import { useState } from "react";
import type { RankedApartment } from "@/lib/ranking";
import type { RoomType } from "@/lib/types";
import ApartmentCard from "./ApartmentCard";

interface Props {
  ranked: RankedApartment[];
  roomType: RoomType;
  hasPriorities: boolean;
}

export default function RankingList({ ranked, roomType, hasPriorities }: Props) {
  // One card open at a time.
  const [openId, setOpenId] = useState<string | null>(null);

  if (!hasPriorities) {
    return (
      <div id="rankingsList" className="empty-state">
        <p className="warning">Set a priority to see your rankings</p>
        <p className="empty-state-hint">Move any slider and the apartments that fit you best appear here, best first</p>
      </div>
    );
  }

  if (ranked.length === 0) {
    return (
      <div id="rankingsList" className="empty-state">
        <p className="empty-message">No apartments match these filters for this room type</p>
      </div>
    );
  }

  return (
    <ol id="rankingsList" className="ranking-list">
      {ranked.map(({ apartment }, index) => (
        <li key={apartment.id}>
          <ApartmentCard
            apartment={apartment}
            rank={index + 1}
            roomType={roomType}
            isOpen={openId === apartment.id}
            onToggle={() => setOpenId((current) => (current === apartment.id ? null : apartment.id))}
          />
        </li>
      ))}
    </ol>
  );
}
