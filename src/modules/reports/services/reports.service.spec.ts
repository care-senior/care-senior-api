import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { StaffRole, UserRole } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { ReportsService } from './reports.service.js';

describe('ReportsService', () => {
  let service: ReportsService;
  const dataSource = { query: vi.fn() };
  const caregiver: AuthenticatedUser = {
    id: 'staff-1',
    role: UserRole.STAFF,
    staffRole: StaffRole.CAREGIVER,
    clinicId: 'clinic-1',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(ReportsService);
  });

  it('defaults to the last 30 days of the caller clinic', async () => {
    dataSource.query.mockResolvedValue([]);

    const { from, to } = await service.activitiesByType({}, caregiver);

    expect(to.getTime() - from.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [
      'clinic-1',
      from,
      to,
    ]);
  });

  it('refuses inverted or too long periods, other clinics and guardians', async () => {
    for (const period of [
      { from: '2026-02-01T00:00:00Z', to: '2026-01-01T00:00:00Z' },
      { from: '2025-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z' },
    ]) {
      await expect(
        service.activityCompletion(period, caregiver),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(
      service.overview({ clinicId: 'clinic-2' }, caregiver),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.overview({}, { id: 'guardian-1', role: UserRole.GUARDIAN }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('fills the days without doses and adds up the period', async () => {
    dataSource.query.mockResolvedValue([
      { date: '2026-10-12', due: 4, taken: 3 },
    ]);

    const report = await service.medicationAdherence(
      { from: '2026-10-11T08:00:00-03:00', to: '2026-10-13T08:00:00-03:00' },
      caregiver,
    );

    expect(report.days).toEqual([
      { date: '2026-10-11', due: 0, taken: 0, rate: null },
      { date: '2026-10-12', due: 4, taken: 3, rate: 0.75 },
      { date: '2026-10-13', due: 0, taken: 0, rate: null },
    ]);
    expect(report.total).toEqual({ due: 4, taken: 3, rate: 0.75 });
  });

  it('averages the ratings and keeps every star in the histogram', async () => {
    dataSource.query.mockResolvedValue([
      { rating: 5, count: 2 },
      { rating: 2, count: 1 },
    ]);

    const summary = await service.feedbackSummary({}, caregiver);

    expect(summary.total).toBe(3);
    expect(summary.average).toBe(4);
    expect(summary.histogram.map(({ count }) => count)).toEqual([
      0, 1, 0, 0, 2,
    ]);
  });
});
