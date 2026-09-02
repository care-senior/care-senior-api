export enum StaffRole {
  COORDINATOR = 'Coordenadora',
  NURSE = 'Enfermeira',
  CAREGIVER = 'Cuidador',
}

// Coordenadora/Enfermeira aprovam ou recusam solicitações (vínculo, saída) e desvinculam idosos.
export const ROLES_THAT_MANAGE_REQUESTS = [
  StaffRole.COORDINATOR,
  StaffRole.NURSE,
];
