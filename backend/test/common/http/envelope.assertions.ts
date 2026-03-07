export function assertSuccessEnvelope(body: unknown): void {
  expect(body).toEqual(
    expect.objectContaining({
      success: true,
      data: expect.anything(),
      meta: expect.objectContaining({
        requestId: expect.any(String),
        timestamp: expect.any(String)
      })
    })
  );
}

export function assertErrorEnvelope(body: unknown, expectedCode?: string): void {
  expect(body).toEqual(
    expect.objectContaining({
      success: false,
      error: expect.objectContaining({
        code: expect.any(String),
        message: expect.any(String)
      }),
      meta: expect.objectContaining({
        requestId: expect.any(String),
        timestamp: expect.any(String)
      })
    })
  );

  if (expectedCode) {
    expect(body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: expectedCode
        })
      })
    );
  }
}
