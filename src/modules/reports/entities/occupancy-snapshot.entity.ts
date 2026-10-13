import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Occupancy of a clinic at the end of a day; see `OccupancySnapshotsService`. */
@Entity('occupancy_snapshots')
export class OccupancySnapshot {
  @PrimaryColumn({ name: 'clinic_id', type: 'uuid' })
  clinicId!: string;

  /** `YYYY-MM-DD`, Brasília. */
  @PrimaryColumn({ type: 'date' })
  day!: string;

  @Column({ name: 'occupied_beds', type: 'int' })
  occupiedBeds!: number;

  @Column({ type: 'int' })
  capacity!: number;
}
