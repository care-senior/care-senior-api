import {
  Column,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
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

  @Column({ name: 'health_notes', type: 'text' })
  healthNotes!: string;

  // Nulo enquanto o idoso não estiver vinculado a nenhuma clínica (autocadastro do
  // responsável, ou após desvinculação/alta) — ver `discharge` no README.
  @Column({ name: 'clinic_id', nullable: true })
  clinicId?: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.residents, { nullable: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic?: Clinic;

  @Column({ name: 'room_id', nullable: true })
  roomId?: string;

  @ManyToOne(() => Room, (room) => room.residents, { nullable: true })
  @JoinColumn({ name: 'room_id' })
  room?: Room;

  // Campo derivado/de leitura para manter o contrato que o mobile já espera
  // (`Resident.roomNumber` como string solta) — nunca persistido, sempre resolvido
  // a partir de `room.number`.
  get roomNumber(): string | undefined {
    return this.room?.number;
  }

  @Column({ type: 'enum', enum: ResidentMood, nullable: true })
  mood?: ResidentMood;

  @Column({ type: 'text', nullable: true })
  peculiarities?: string;

  @Column({ name: 'photo_path', nullable: true })
  photoPath?: string;

  @Column({ name: 'emergency_contact_name', nullable: true })
  emergencyContactName?: string;

  @Column({ name: 'emergency_contact_phone', nullable: true })
  emergencyContactPhone?: string;

  @ManyToMany(() => Guardian, (guardian) => guardian.residents)
  guardians!: Guardian[];

  @OneToMany(() => HealthRecord, (healthRecord) => healthRecord.resident)
  healthRecords!: HealthRecord[];

  @OneToMany(() => ActivityParticipant, (participant) => participant.resident)
  activityParticipations!: ActivityParticipant[];

  @OneToMany(() => OutingRequest, (outingRequest) => outingRequest.resident)
  outingRequests!: OutingRequest[];

  @OneToMany(() => Medication, (medication) => medication.resident)
  medications!: Medication[];

  @OneToMany(() => Message, (message) => message.resident)
  messages!: Message[];
}
