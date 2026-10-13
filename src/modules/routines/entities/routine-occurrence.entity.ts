import { Column, Entity, PrimaryColumn } from 'typeorm';

/** A slot a routine already generated; see `RoutineActivitiesService`. */
@Entity('routine_occurrences')
export class RoutineOccurrence {
  @PrimaryColumn({ name: 'routine_id', type: 'uuid' })
  routineId!: string;

  @PrimaryColumn({ name: 'occurs_at', type: 'timestamptz' })
  occursAt!: Date;

  /** Null once someone edits the generated activity by hand. */
  @Column({ name: 'activity_id', type: 'uuid', nullable: true })
  activityId!: string | null;
}
