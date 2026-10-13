/** SQL for the beds taken now in the clinic `clinicId` (a column or parameter). */
export const occupiedBedsSql = (clinicId: string) =>
  `(SELECT count(*)::int FROM residents
    WHERE residents.clinic_id = ${clinicId} AND residents.room_id IS NOT NULL)`;

/** SQL for the sum of the room capacities of the clinic `clinicId`. */
export const capacitySql = (clinicId: string) =>
  `(SELECT coalesce(sum(rooms.capacity), 0)::int FROM rooms
    WHERE rooms.clinic_id = ${clinicId})`;
