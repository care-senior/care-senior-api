import {
  Column,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity.js';
import { Room } from '../../rooms/entities/room.entity.js';
import { Guardian } from '../../guardians/entities/guardian.entity.js';
import { HealthRecord } from '../../health-records/entities/health-record.entity.js';
import { ActivityParticipant } from '../../activities/entities/activity-participant.entity.js';
import { OutingRequest } from '../../outing-requests/entities/outing-request.entity.js';
import { Medication } from '../../medications/entities/medication.entity.js';
import { Message } from '../../messages/entities/message.entity.js';
import { ResidentMood } from '../../common/enums/index.js';

@Entity('residents')
export class Resident {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'int' })
  age!: number;

  @Column({ name: 'health_notes', type: 'text', nullable: true })
  healthNotes?: string | null;

  @Column({ name: 'clinic_id', type: 'uuid', nullable: true })
  clinicId?: string | null;

  @ManyToOne(() => Clinic, (clinic) => clinic.residents, { nullable: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic?: Relation<Clinic> | null;

  @Column({ name: 'room_id', type: 'uuid', nullable: true })
  roomId?: string | null;

  @ManyToOne(() => Room, (room) => room.residents, { nullable: true })
  @JoinColumn({ name: 'room_id' })
  room?: Relation<Room> | null;

  get roomNumber(): string | undefined {
    return this.room?.number;
  }

  @Column({
    type: 'enum',
    enum: ResidentMood,
    enumName: 'resident_mood',
    nullable: true,
  })
  mood?: ResidentMood | null;

  @Column({ type: 'text', nullable: true })
  peculiarities?: string | null;

  @Column({ name: 'photo_path', type: 'varchar', nullable: true })
  photoPath?: string | null;

  @Column({ name: 'emergency_contact_name', type: 'varchar', nullable: true })
  emergencyContactName?: string | null;

  @Column({
    name: 'emergency_contact_phone',
    type: 'varchar',
    nullable: true,
  })
  emergencyContactPhone?: string | null;

  @ManyToMany(() => Guardian, (guardian) => guardian.residents)
  guardians!: Relation<Guardian[]>;

  @OneToMany(() => HealthRecord, (healthRecord) => healthRecord.resident)
  healthRecords!: Relation<HealthRecord[]>;

  @OneToMany(() => ActivityParticipant, (participant) => participant.resident)
  activityParticipations!: Relation<ActivityParticipant[]>;

  @OneToMany(() => OutingRequest, (outingRequest) => outingRequest.resident)
  outingRequests!: Relation<OutingRequest[]>;

  @OneToMany(() => Medication, (medication) => medication.resident)
  medications!: Relation<Medication[]>;

  @OneToMany(() => Message, (message) => message.resident)
  messages!: Relation<Message[]>;
}
