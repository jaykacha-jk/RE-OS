import { PartialType } from '@nestjs/swagger';

import { CreatePropertyDto } from './create-property.dto';

/**
 * All fields optional. `status` transitions are validated in the service layer
 * against PROPERTY_STATUS_TRANSITIONS.
 */
export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}
