import { HttpStatus, applyDecorators, type Type } from '@nestjs/common';
import { ApiCreatedResponse, ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

import {
  ApiMetaDto,
  ApiSuccessEnvelopeDto,
  SUCCESS_RESPONSE_META_EXAMPLE
} from './dto/api-meta.dto';

interface ApiSuccessResponseOptions<TModel extends Type<unknown>> {
  type: TModel;
  description: string;
  example: unknown;
  status?: HttpStatus.OK | HttpStatus.CREATED;
}

export function ApiSuccessResponse<TModel extends Type<unknown>>(
  options: ApiSuccessResponseOptions<TModel>
): MethodDecorator {
  const responseDecorator =
    options.status === HttpStatus.CREATED ? ApiCreatedResponse : ApiOkResponse;

  return applyDecorators(
    ApiExtraModels(ApiMetaDto, ApiSuccessEnvelopeDto, options.type),
    responseDecorator({
      description: options.description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiSuccessEnvelopeDto) },
          {
            type: 'object',
            properties: {
              data: {
                $ref: getSchemaPath(options.type)
              }
            },
            required: ['data']
          }
        ],
        example: {
          success: true,
          data: options.example,
          meta: SUCCESS_RESPONSE_META_EXAMPLE
        }
      }
    })
  );
}
