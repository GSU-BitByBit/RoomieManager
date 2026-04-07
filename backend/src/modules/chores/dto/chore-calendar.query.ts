import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDate,
  IsDefined,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator';

import { transformDateOnlyValue, toDateOnlyUtc } from '../../../common/time/date-only.util';
import { CHORE_GENERATION_HORIZON_DAYS } from '../chore.constants';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

@ValidatorConstraint({ name: 'ChoreCalendarRange', async: false })
class ChoreCalendarRangeConstraint implements ValidatorConstraintInterface {
  validate(endValue: unknown, args: ValidationArguments): boolean {
    if (!(endValue instanceof Date) || Number.isNaN(endValue.getTime())) {
      return false;
    }

    const object = args.object as ChoreCalendarQueryDto;
    if (!(object.start instanceof Date) || Number.isNaN(object.start.getTime())) {
      return true;
    }

    const start = toDateOnlyUtc(object.start);
    const end = toDateOnlyUtc(endValue);
    const daySpan = Math.round((end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY);

    return daySpan >= 0 && daySpan <= CHORE_GENERATION_HORIZON_DAYS;
  }

  defaultMessage(): string {
    return `Calendar range must use start <= end and span no more than ${CHORE_GENERATION_HORIZON_DAYS} days.`;
  }
}

export class ChoreCalendarQueryDto {
  @ApiProperty({
    example: '2026-04-06',
    description: 'Inclusive calendar start date (YYYY-MM-DD).'
  })
  @Transform(({ value }) => transformDateOnlyValue(value))
  @IsDefined()
  @IsDate()
  start!: Date;

  @ApiProperty({
    example: '2026-05-18',
    description:
      'Inclusive calendar end date (YYYY-MM-DD). Must be on or after start and no more than 56 days later.'
  })
  @Transform(({ value }) => transformDateOnlyValue(value))
  @IsDefined()
  @IsDate()
  @Validate(ChoreCalendarRangeConstraint)
  end!: Date;
}
