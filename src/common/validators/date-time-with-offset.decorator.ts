import { applyDecorators } from '@nestjs/common';
import { IsISO8601, Matches } from 'class-validator';

const ENDS_WITH_OFFSET = /(Z|[+-]\d{2}:\d{2})$/;

/**
 * ISO 8601 date-time with an explicit offset (`Z` or `±hh:mm`), so the moment
 * never depends on the server time zone.
 */
export const IsDateTimeWithOffset = () =>
  applyDecorators(
    IsISO8601({ strict: true }),
    Matches(ENDS_WITH_OFFSET, {
      message: ({ property }) =>
        `${property} must be a date-time with a time zone offset`,
    }),
  );
