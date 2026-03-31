import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import { generateOpenApiTypes } from './generate-openapi-types';

async function main(): Promise<void> {
  const baselinePath = resolve('../frontend/generated/backend-api.types.ts');
  const tempPath = resolve('openapi/.openapi-types.tmp.ts');

  await generateOpenApiTypes(tempPath);

  try {
    const [baseline, generated] = await Promise.all([
      readFile(baselinePath, 'utf8'),
      readFile(tempPath, 'utf8')
    ]);

    if (baseline !== generated) {
      // eslint-disable-next-line no-console
      console.error(
        'OpenAPI TypeScript contract drift detected. Run: pnpm openapi:types:generate'
      );
      process.exitCode = 1;
      return;
    }

    // eslint-disable-next-line no-console
    console.log('OpenAPI TypeScript contract check passed.');
  } finally {
    await rm(tempPath, { force: true });
  }
}

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('OpenAPI TypeScript contract check failed:', error);
  process.exitCode = 1;
});
