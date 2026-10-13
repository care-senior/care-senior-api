export class OverviewReportDto {
  /** Residents linked to the clinic. */
  activeResidents!: number;

  /** Staff members not deactivated. */
  activeStaff!: number;

  occupiedBeds!: number;

  /** Sum of the capacity of the rooms. */
  capacity!: number;

  /** `occupiedBeds / capacity`, from 0 to 1; null without rooms. */
  occupancyRate!: number | null;

  /** Same count as the link request queue. */
  pendingLinkRequests!: number;

  pendingOutingRequests!: number;
}
