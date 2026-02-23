import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import { generateOpenApi } from './generate-openapi';

async function main(): Promise<void> {
  const baselinePath = resolve('openapi/openapi.json');
  const tempPath = resolve('openapi/.openapi.tmp.json');

  await generateOpenApi(tempPath);

  try {
    const [baseline, generated] = await Promise.all([
      readFile(baselinePath, 'utf8'),
      readFile(tempPath, 'utf8')
    ]);

    if (baseline !== generated) {
      // eslint-disable-next-line no-console
      console.error('OpenAPI contract drift detected. Run: pnpm openapi:generate');
      process.exitCode = 1;
      return;
    }

    // eslint-disable-next-line no-console
    console.log('OpenAPI contract check passed.');
  } finally {
    await rm(tempPath, { force: true });
  }
}

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('OpenAPI contract check failed:', error);
  process.exitCode = 1;
});
