export enum StaffRole {
  COORDINATOR = 'Coordenadora',
  NURSE = 'Enfermeira',
  CAREGIVER = 'Cuidador',
}

export const ROLES_THAT_MANAGE_REQUESTS = [
  StaffRole.COORDINATOR,
  StaffRole.NURSE,
];
