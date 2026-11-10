import { ROOM_TYPES, STUDENT_TYPES } from "@/lib/options";
import type { RoomType, StudentType } from "@/lib/types";
import { Info } from "./icons";

interface Props {
  roomType: RoomType;
  studentType: StudentType;
  onRoomTypeChange: (roomType: RoomType) => void;
  onStudentTypeChange: (studentType: StudentType) => void;
}

export default function AboutYou({ roomType, studentType, onRoomTypeChange, onStudentTypeChange }: Props) {
  return (
    <>
      <p className="aboutYouText">
        You are looking for a{" "}
        <select
          id="bedrooms"
          className="inline-select"
          aria-label="Room type"
          value={roomType}
          onChange={(event) => onRoomTypeChange(event.target.value as RoomType)}
        >
          {ROOM_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>{" "}
        apartment.
      </p>
      <p className="aboutYouText">
        You are a{" "}
        <select
          id="studentType"
          className="inline-select"
          aria-label="Student type"
          value={studentType}
          onChange={(event) => onStudentTypeChange(event.target.value as StudentType)}
        >
          {STUDENT_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>{" "}
        student.
      </p>
      <p className="info-message">
        <Info className="info-icon" />
        Please note: Certain apartments are not available to undergraduate students.
      </p>
    </>
  );
}
