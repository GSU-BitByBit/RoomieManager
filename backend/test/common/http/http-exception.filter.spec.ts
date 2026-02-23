import { BadRequestException } from '@nestjs/common';

import { HttpExceptionFilter } from '../../../src/common/http/http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('maps known http exceptions into error envelope', () => {
    const filter = new HttpExceptionFilter();
    const statusMock = jest.fn().mockReturnThis();
    const jsonMock = jest.fn();

    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock, json: jsonMock }),
        getRequest: () => ({ headers: { 'x-request-id': 'req-123' } })
      })
    };

    filter.catch(new BadRequestException('Invalid payload'), host as any);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'BAD_REQUEST',
          message: 'Invalid payload'
        }),
        meta: expect.objectContaining({ requestId: 'req-123' })
      })
    );
  });

  it('maps unknown exceptions to INTERNAL_ERROR', () => {
    const filter = new HttpExceptionFilter();
    const statusMock = jest.fn().mockReturnThis();
    const jsonMock = jest.fn();

    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock, json: jsonMock }),
        getRequest: () => ({ headers: {} })
      })
    };

    filter.catch('unexpected error', host as any);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        })
      })
    );
  });
});
