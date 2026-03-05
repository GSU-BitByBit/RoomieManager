import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import { generateOpenApi } from './generate-openapi';

interface OpenApiParameter {
  in?: string;
  name?: string;
  required?: boolean;
  schema?: {
    type?: string;
  };
}

interface OpenApiResponse {
  content?: {
    'application/json'?: {
      schema?: {
        example?: unknown;
      };
    };
  };
}

interface OpenApiOperation {
  parameters?: OpenApiParameter[];
  responses?: Record<string, OpenApiResponse>;
  requestBody?: {
    required?: boolean;
  };
  security?: Array<Record<string, unknown>>;
}

interface OpenApiDocument {
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface EndpointContract {
  path: string;
  method: HttpMethod;
  statusCodes: string[];
  requiresAuth: boolean;
  requiredPathParams?: string[];
  requiresRequestBody?: boolean;
}

interface ListEndpointContract {
  path: string;
  method: 'get';
  collectionKey: 'groups' | 'members' | 'chores' | 'versions' | 'bills';
  statusCodes: string[];
  queryParams: Array<{
    name: string;
    type?: 'string' | 'number';
  }>;
}

const REQUIRED_PAGINATION_KEYS = [
  'page',
  'pageSize',
  'totalItems',
  'totalPages',
  'hasNextPage',
  'hasPreviousPage'
] as const;

const LIST_ENDPOINT_CONTRACTS: ListEndpointContract[] = [
  {
    path: '/api/v1/groups',
    method: 'get',
    collectionKey: 'groups',
    statusCodes: ['200', '400', '401'],
    queryParams: [
      { name: 'page', type: 'number' },
      { name: 'pageSize', type: 'number' },
      { name: 'sortBy', type: 'string' },
      { name: 'sortOrder', type: 'string' }
    ]
  },
  {
    path: '/api/v1/groups/{groupId}/members',
    method: 'get',
    collectionKey: 'members',
    statusCodes: ['200', '400', '401', '403'],
    queryParams: [
      { name: 'page', type: 'number' },
      { name: 'pageSize', type: 'number' },
      { name: 'sortBy', type: 'string' },
      { name: 'sortOrder', type: 'string' }
    ]
  },
  {
    path: '/api/v1/groups/{groupId}/chores',
    method: 'get',
    collectionKey: 'chores',
    statusCodes: ['200', '400', '401', '403'],
    queryParams: [
      { name: 'status' },
      { name: 'assigneeUserId', type: 'string' },
      { name: 'dueAfter', type: 'string' },
      { name: 'dueBefore', type: 'string' },
      { name: 'page', type: 'number' },
      { name: 'pageSize', type: 'number' },
      { name: 'sortBy', type: 'string' },
      { name: 'sortOrder', type: 'string' }
    ]
  },
  {
    path: '/api/v1/groups/{groupId}/contract/versions',
    method: 'get',
    collectionKey: 'versions',
    statusCodes: ['200', '400', '401', '403'],
    queryParams: [
      { name: 'page', type: 'number' },
      { name: 'pageSize', type: 'number' },
      { name: 'sortBy', type: 'string' },
      { name: 'sortOrder', type: 'string' }
    ]
  },
  {
    path: '/api/v1/groups/{groupId}/bills',
    method: 'get',
    collectionKey: 'bills',
    statusCodes: ['200', '400', '401', '403'],
    queryParams: [
      { name: 'page', type: 'number' },
      { name: 'pageSize', type: 'number' },
      { name: 'sortBy', type: 'string' },
      { name: 'sortOrder', type: 'string' }
    ]
  }
];

const CORE_ENDPOINT_CONTRACTS: EndpointContract[] = [
  {
    path: '/api/v1/health/live',
    method: 'get',
    statusCodes: ['200'],
    requiresAuth: false
  },
  {
    path: '/api/v1/health/ready',
    method: 'get',
    statusCodes: ['200', '503'],
    requiresAuth: false
  },
  {
    path: '/api/v1/auth/register',
    method: 'post',
    statusCodes: ['201'],
    requiresAuth: false,
    requiresRequestBody: true
  },
  {
    path: '/api/v1/auth/login',
    method: 'post',
    statusCodes: ['200'],
    requiresAuth: false,
    requiresRequestBody: true
  },
  {
    path: '/api/v1/auth/me',
    method: 'get',
    statusCodes: ['200', '401'],
    requiresAuth: true
  },
  {
    path: '/api/v1/groups',
    method: 'get',
    statusCodes: ['200', '400', '401'],
    requiresAuth: true
  },
  {
    path: '/api/v1/groups',
    method: 'post',
    statusCodes: ['201', '401'],
    requiresAuth: true,
    requiresRequestBody: true
  },
  {
    path: '/api/v1/groups/join',
    method: 'post',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiresRequestBody: true
  },
  {
    path: '/api/v1/groups/{groupId}',
    method: 'get',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId']
  },
  {
    path: '/api/v1/groups/{groupId}/dashboard',
    method: 'get',
    statusCodes: ['200', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['groupId']
  },
  {
    path: '/api/v1/groups/{groupId}/join-code/reset',
    method: 'post',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId']
  },
  {
    path: '/api/v1/groups/{groupId}/members',
    method: 'get',
    statusCodes: ['200', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['groupId']
  },
  {
    path: '/api/v1/groups/{groupId}/members/{userId}/role',
    method: 'patch',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId', 'userId'],
    requiresRequestBody: true
  },
  {
    path: '/api/v1/groups/{groupId}/members/{userId}',
    method: 'delete',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId', 'userId']
  },
  {
    path: '/api/v1/groups/{groupId}/chores',
    method: 'post',
    statusCodes: ['201', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId'],
    requiresRequestBody: true
  },
  {
    path: '/api/v1/groups/{groupId}/chores',
    method: 'get',
    statusCodes: ['200', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['groupId']
  },
  {
    path: '/api/v1/chores/{choreId}/assign',
    method: 'patch',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredPathParams: ['choreId'],
    requiresRequestBody: true
  },
  {
    path: '/api/v1/chores/{choreId}/complete',
    method: 'patch',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredPathParams: ['choreId']
  },
  {
    path: '/api/v1/groups/{groupId}/contract',
    method: 'get',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId']
  },
  {
    path: '/api/v1/groups/{groupId}/contract',
    method: 'put',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId'],
    requiresRequestBody: true
  },
  {
    path: '/api/v1/groups/{groupId}/contract/publish',
    method: 'post',
    statusCodes: ['201', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId']
  },
  {
    path: '/api/v1/groups/{groupId}/contract/versions',
    method: 'get',
    statusCodes: ['200', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['groupId']
  },
  {
    path: '/api/v1/groups/{groupId}/bills',
    method: 'post',
    statusCodes: ['201', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId'],
    requiresRequestBody: true
  },
  {
    path: '/api/v1/groups/{groupId}/bills',
    method: 'get',
    statusCodes: ['200', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['groupId']
  },
  {
    path: '/api/v1/groups/{groupId}/payments',
    method: 'post',
    statusCodes: ['201', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId'],
    requiresRequestBody: true
  },
  {
    path: '/api/v1/groups/{groupId}/balances',
    method: 'get',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId']
  }
];

function getOperation(
  document: OpenApiDocument,
  method: HttpMethod,
  path: string
): OpenApiOperation {
  const operation = document.paths?.[path]?.[method];
  if (!operation) {
    throw new Error(`Missing operation: ${method.toUpperCase()} ${path}`);
  }

  return operation;
}

function assertHasExpectedStatusCodes(
  responses: Record<string, OpenApiResponse>,
  contract: EndpointContract
): void {
  for (const statusCode of contract.statusCodes) {
    if (!(statusCode in responses)) {
      throw new Error(
        `Missing ${statusCode} response in ${contract.method.toUpperCase()} ${contract.path}`
      );
    }
  }
}

function assertAuthContract(operation: OpenApiOperation, contract: EndpointContract): void {
  const hasBearerSecurity = Array.isArray(operation.security)
    ? operation.security.some((securitySpec) => 'bearer' in securitySpec)
    : false;

  if (contract.requiresAuth && !hasBearerSecurity) {
    throw new Error(
      `Missing bearer security requirement in ${contract.method.toUpperCase()} ${contract.path}`
    );
  }

  if (!contract.requiresAuth && hasBearerSecurity) {
    throw new Error(
      `Unexpected bearer security requirement in public endpoint ${contract.method.toUpperCase()} ${contract.path}`
    );
  }
}

function assertPathParams(operation: OpenApiOperation, contract: EndpointContract): void {
  const requiredPathParams = contract.requiredPathParams ?? [];
  if (requiredPathParams.length === 0) {
    return;
  }

  const pathParams = (operation.parameters ?? []).filter(
    (parameter) => parameter.in === 'path' && typeof parameter.name === 'string'
  );

  for (const paramName of requiredPathParams) {
    const param = pathParams.find((candidate) => candidate.name === paramName);
    if (!param) {
      throw new Error(
        `Missing path parameter "${paramName}" in ${contract.method.toUpperCase()} ${contract.path}`
      );
    }

    if (param.required !== true) {
      throw new Error(
        `Path parameter "${paramName}" must be required in ${contract.method.toUpperCase()} ${contract.path}`
      );
    }

    if (param.schema?.type !== 'string') {
      throw new Error(
        `Path parameter "${paramName}" must be type=string in ${contract.method.toUpperCase()} ${contract.path}`
      );
    }
  }
}

function assertRequestBodyContract(operation: OpenApiOperation, contract: EndpointContract): void {
  if (!contract.requiresRequestBody) {
    return;
  }

  if (!operation.requestBody) {
    throw new Error(
      `Missing required request body in ${contract.method.toUpperCase()} ${contract.path}`
    );
  }

  if (operation.requestBody.required !== true) {
    throw new Error(
      `Request body must be marked required in ${contract.method.toUpperCase()} ${contract.path}`
    );
  }
}

function assertOpenApiCoreContracts(document: OpenApiDocument): void {
  for (const contract of CORE_ENDPOINT_CONTRACTS) {
    const operation = getOperation(document, contract.method, contract.path);
    const responses = operation.responses ?? {};

    assertHasExpectedStatusCodes(responses, contract);
    assertAuthContract(operation, contract);
    assertPathParams(operation, contract);
    assertRequestBodyContract(operation, contract);
  }
}

function assertOpenApiListContracts(document: OpenApiDocument): void {
  for (const contract of LIST_ENDPOINT_CONTRACTS) {
    const operation = getOperation(document, contract.method, contract.path);

    const queryParams = (operation.parameters ?? []).filter(
      (parameter) => parameter.in === 'query' && typeof parameter.name === 'string'
    );

    for (const expectedQueryParam of contract.queryParams) {
      const queryParam = queryParams.find(
        (parameter) => parameter.name === expectedQueryParam.name
      );

      if (!queryParam) {
        throw new Error(
          `Missing query parameter "${expectedQueryParam.name}" in ${contract.method.toUpperCase()} ${contract.path}`
        );
      }

      if (
        expectedQueryParam.type &&
        queryParam.schema?.type !== expectedQueryParam.type
      ) {
        throw new Error(
          `Query parameter "${expectedQueryParam.name}" must be type=${expectedQueryParam.type} in ${contract.method.toUpperCase()} ${contract.path}`
        );
      }
    }

    const responses = operation.responses ?? {};
    assertHasExpectedStatusCodes(responses, {
      path: contract.path,
      method: contract.method,
      statusCodes: contract.statusCodes,
      requiresAuth: true
    });

    const successResponse = responses['200'];
    const example = successResponse?.content?.['application/json']?.schema?.example as
      | { success?: unknown; data?: unknown }
      | undefined;

    if (!example || typeof example !== 'object') {
      throw new Error(
        `Missing 200 response example in ${contract.method.toUpperCase()} ${contract.path}`
      );
    }

    if (example.success !== true) {
      throw new Error(
        `200 response example must include success=true in ${contract.method.toUpperCase()} ${contract.path}`
      );
    }

    if (!example.data || typeof example.data !== 'object') {
      throw new Error(
        `200 response example must include data object in ${contract.method.toUpperCase()} ${contract.path}`
      );
    }

    const data = example.data as Record<string, unknown>;
    if (!Array.isArray(data[contract.collectionKey])) {
      throw new Error(
        `200 response example must include "${contract.collectionKey}" array in ${contract.method.toUpperCase()} ${contract.path}`
      );
    }

    if (!data.pagination || typeof data.pagination !== 'object') {
      throw new Error(
        `200 response example must include pagination object in ${contract.method.toUpperCase()} ${contract.path}`
      );
    }

    const pagination = data.pagination as Record<string, unknown>;
    for (const key of REQUIRED_PAGINATION_KEYS) {
      if (!(key in pagination)) {
        throw new Error(
          `200 response example pagination must include "${key}" in ${contract.method.toUpperCase()} ${contract.path}`
        );
      }
    }
  }
}

async function main(): Promise<void> {
  const baselinePath = resolve('openapi/openapi.json');
  const tempPath = resolve('openapi/.openapi.tmp.json');

  await generateOpenApi(tempPath);

  try {
    const [baseline, generated] = await Promise.all([
      readFile(baselinePath, 'utf8'),
      readFile(tempPath, 'utf8')
    ]);

    const generatedDocument = JSON.parse(generated) as OpenApiDocument;
    assertOpenApiCoreContracts(generatedDocument);
    assertOpenApiListContracts(generatedDocument);

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
