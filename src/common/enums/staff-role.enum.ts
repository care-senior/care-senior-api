export enum StaffRole {
  COORDENADORA = 'Coordenadora',
  ENFERMEIRA = 'Enfermeira',
  CUIDADOR = 'Cuidador',
}

// Coordenadora/Enfermeira aprovam ou recusam solicitações (vínculo, saída) e desvinculam idosos.
export const ROLES_THAT_MANAGE_REQUESTS = [
  StaffRole.COORDENADORA,
  StaffRole.ENFERMEIRA,
];
