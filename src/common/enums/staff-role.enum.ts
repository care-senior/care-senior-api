export enum StaffRole {
  COORDINATOR = 'coordinator',
  NURSE = 'nurse',
  CAREGIVER = 'caregiver',
}

export const ROLES_THAT_MANAGE_REQUESTS = [
  StaffRole.COORDINATOR,
  StaffRole.NURSE,
];
