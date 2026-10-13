import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StaffRole, UserRole } from '../common/enums/index.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface.js';
import { ClinicsService } from './clinics.service.js';
import { Clinic } from './entities/clinic.entity.js';

describe('ClinicsService', () => {
  let service: ClinicsService;
  let clinicRepository: {
    findOne: ReturnType<typeof vi.fn>;
    merge: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  const clinic = (): Clinic =>
    Object.assign(new Clinic(), {
      id: 'clinic-1',
      name: 'Residencial Vida Plena',
      address: 'Rua das Acácias, 120',
      phone: '(61) 3333-1010',
      operatingHours: '24h',
      activities: ['Fisioterapia'],
      responsiblePeople: 'Juliana Martins',
      whatsappPhone: '(61) 93333-1010',
      latitude: -15.8,
      longitude: -48,
      residents: [],
    });

  const nurse: AuthenticatedUser = {
    id: 'staff-1',
    role: UserRole.STAFF,
    staffRole: StaffRole.NURSE,
    clinicId: 'clinic-1',
  };

  beforeEach(async () => {
    clinicRepository = {
      findOne: vi.fn(),
      merge: vi.fn((target: Clinic, changes: Partial<Clinic>) =>
        Object.assign(target, changes),
      ),
      save: vi.fn((entity: Clinic) => Promise.resolve(entity)),
    };
    const module = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: getRepositoryToken(Clinic), useValue: clinicRepository },
      ],
    }).compile();
    service = module.get(ClinicsService);
  });

  it('returns only the public columns of a clinic', async () => {
    clinicRepository.findOne.mockResolvedValue(clinic());

    const response = await service.findOne('clinic-1');

    expect(response).toMatchObject({
      id: 'clinic-1',
      name: 'Residencial Vida Plena',
    });
    expect(response).not.toHaveProperty('residents');
  });

  it('throws NotFoundException for an unknown clinic', async () => {
    clinicRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates only the fields sent', async () => {
    clinicRepository.findOne.mockResolvedValue(clinic());

    const response = await service.update(
      'clinic-1',
      { phone: '(61) 3000-0000' },
      nurse,
    );

    expect(response).toMatchObject({
      phone: '(61) 3000-0000',
      name: 'Residencial Vida Plena',
    });
  });

  it("forbids editing another staff member's clinic", async () => {
    await expect(
      service.update('clinic-2', { name: 'Other' }, nurse),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(clinicRepository.save).not.toHaveBeenCalled();
  });
});
