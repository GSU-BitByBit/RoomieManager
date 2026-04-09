import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import { generateOpenApi } from './generate-openapi';

interface OpenApiParameter {
  in?: string;
  name?: string;
  required?: boolean;
  schema?: {
    type?: string;
    minimum?: number;
    maximum?: number;
    enum?: unknown[];
    example?: unknown;
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
  summary?: string;
  tags?: string[];
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
  successStatusCode?: string;
  requiredDataKeys?: string[];
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

interface AggregateEndpointContract {
  path: string;
  method: 'get';
  statusCodes: string[];
  requiredDataKeys: string[];
}

const REQUIRED_PAGINATION_KEYS = [
  'page',
  'pageSize',
  'totalItems',
  'totalPages',
  'hasNextPage',
  'hasPreviousPage'
] as const;

const REQUIRED_SORT_ORDER_VALUES = ['asc', 'desc'];

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
      { name: 'dueOnFrom', type: 'string' },
      { name: 'dueOnTo', type: 'string' },
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

const AGGREGATE_ENDPOINT_CONTRACTS: AggregateEndpointContract[] = [
  {
    path: '/api/v1/groups/{groupId}/dashboard',
    method: 'get',
    statusCodes: ['200', '400', '401', '403'],
    requiredDataKeys: ['group', 'members', 'chores', 'finance', 'contract']
  }
];

const CORE_ENDPOINT_CONTRACTS: EndpointContract[] = [
  {
    path: '/api/v1/health/live',
    method: 'get',
    statusCodes: ['200'],
    requiresAuth: false,
    requiredDataKeys: ['service', 'version', 'timestamp']
  },
  {
    path: '/api/v1/health/ready',
    method: 'get',
    statusCodes: ['200', '503'],
    requiresAuth: false,
    requiredDataKeys: ['checks']
  },
  {
    path: '/api/v1/auth/register',
    method: 'post',
    statusCodes: ['201'],
    requiresAuth: false,
    requiresRequestBody: true,
    requiredDataKeys: ['user', 'session']
  },
  {
    path: '/api/v1/auth/login',
    method: 'post',
    statusCodes: ['200'],
    requiresAuth: false,
    requiresRequestBody: true,
    requiredDataKeys: ['user', 'session']
  },
  {
    path: '/api/v1/auth/me',
    method: 'get',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredDataKeys: ['id']
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
    requiresRequestBody: true,
    requiredDataKeys: ['id', 'name', 'memberRole', 'memberStatus', 'memberCount']
  },
  {
    path: '/api/v1/groups/join',
    method: 'post',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiresRequestBody: true,
    requiredDataKeys: ['id', 'name', 'memberRole', 'memberStatus', 'memberCount']
  },
  {
    path: '/api/v1/groups/{groupId}',
    method: 'get',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId'],
    requiredDataKeys: ['id', 'name', 'memberRole', 'memberStatus', 'memberCount']
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
    requiredPathParams: ['groupId'],
    requiredDataKeys: ['groupId', 'joinCode']
  },
  {
    path: '/api/v1/groups/{groupId}/members',
    method: 'get',
    statusCodes: ['200', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['groupId']
  },
  {
    path: '/api/v1/groups/{groupId}/leave',
    method: 'post',
    statusCodes: ['200', '400', '401', '403', '409'],
    requiresAuth: true,
    requiredPathParams: ['groupId'],
    requiredDataKeys: ['groupId', 'userId', 'status', 'left', 'updatedAt']
  },
  {
    path: '/api/v1/groups/{groupId}',
    method: 'delete',
    statusCodes: ['200', '400', '401', '403', '409'],
    requiresAuth: true,
    requiredPathParams: ['groupId'],
    requiredDataKeys: ['groupId', 'destroyed']
  },
  {
    path: '/api/v1/groups/{groupId}/members/{userId}/role',
    method: 'patch',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId', 'userId'],
    requiresRequestBody: true,
    requiredDataKeys: ['groupId', 'userId', 'role', 'status', 'updatedAt']
  },
  {
    path: '/api/v1/groups/{groupId}/members/{userId}',
    method: 'delete',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId', 'userId'],
    requiredDataKeys: ['groupId', 'userId', 'status', 'removed', 'updatedAt']
  },
  {
    path: '/api/v1/groups/{groupId}/chores',
    method: 'post',
    statusCodes: ['201', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['groupId'],
    requiresRequestBody: true,
    requiredDataKeys: ['id', 'groupId', 'title', 'status', 'dueOn', 'assigneeUserId', 'createdBy']
  },
  {
    path: '/api/v1/groups/{groupId}/chores',
    method: 'get',
    statusCodes: ['200', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['groupId']
  },
  {
    path: '/api/v1/groups/{groupId}/chores/calendar',
    method: 'get',
    statusCodes: ['200', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['groupId'],
    requiredDataKeys: ['groupId', 'start', 'end', 'occurrences']
  },
  {
    path: '/api/v1/chores/{occurrenceId}/assignee',
    method: 'patch',
    statusCodes: ['200', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['occurrenceId'],
    requiresRequestBody: true,
    requiredDataKeys: [
      'id',
      'groupId',
      'title',
      'status',
      'dueOn',
      'createdBy',
      'assigneeUserId'
    ]
  },
  {
    path: '/api/v1/chores/{occurrenceId}/complete',
    method: 'patch',
    statusCodes: ['200', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['occurrenceId'],
    requiredDataKeys: [
      'id',
      'groupId',
      'title',
      'status',
      'dueOn',
      'createdBy',
      'completedByUserId'
    ]
  },
  {
    path: '/api/v1/groups/{groupId}/chore-templates',
    method: 'get',
    statusCodes: ['200', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['groupId'],
    requiredDataKeys: ['groupId', 'templates']
  },
  {
    path: '/api/v1/groups/{groupId}/chore-templates',
    method: 'post',
    statusCodes: ['201', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['groupId'],
    requiresRequestBody: true,
    requiredDataKeys: [
      'id',
      'groupId',
      'title',
      'status',
      'startsOn',
      'repeatEveryDays',
      'assignmentStrategy',
      'assigneeUserId',
      'participants'
    ]
  },
  {
    path: '/api/v1/groups/{groupId}/chore-templates/{templateId}',
    method: 'patch',
    statusCodes: ['200', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['groupId', 'templateId'],
    requiresRequestBody: true,
    requiredDataKeys: [
      'id',
      'groupId',
      'title',
      'status',
      'startsOn',
      'repeatEveryDays',
      'assignmentStrategy',
      'assigneeUserId',
      'participants'
    ]
  },
  {
    path: '/api/v1/groups/{groupId}/chore-templates/{templateId}/pause',
    method: 'post',
    statusCodes: ['200', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['groupId', 'templateId'],
    requiredDataKeys: [
      'id',
      'groupId',
      'status',
      'startsOn',
      'repeatEveryDays',
      'assignmentStrategy',
      'assigneeUserId',
      'participants'
    ]
  },
  {
    path: '/api/v1/groups/{groupId}/chore-templates/{templateId}/resume',
    method: 'post',
    statusCodes: ['200', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['groupId', 'templateId'],
    requiredDataKeys: [
      'id',
      'groupId',
      'status',
      'startsOn',
      'repeatEveryDays',
      'assignmentStrategy',
      'assigneeUserId',
      'participants'
    ]
  },
  {
    path: '/api/v1/groups/{groupId}/chore-templates/{templateId}/archive',
    method: 'post',
    statusCodes: ['200', '400', '401', '403'],
    requiresAuth: true,
    requiredPathParams: ['groupId', 'templateId'],
    requiredDataKeys: [
      'id',
      'groupId',
      'status',
      'startsOn',
      'repeatEveryDays',
      'assignmentStrategy',
      'assigneeUserId',
      'participants'
    ]
  },
  {
    path: '/api/v1/groups/{groupId}/contract',
    method: 'get',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId'],
    requiredDataKeys: ['contract', 'latestPublishedContent']
  },
  {
    path: '/api/v1/groups/{groupId}/contract',
    method: 'put',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId'],
    requiresRequestBody: true,
    requiredDataKeys: ['id', 'groupId', 'draftContent', 'publishedVersion']
  },
  {
    path: '/api/v1/groups/{groupId}/contract/publish',
    method: 'post',
    statusCodes: ['201', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId'],
    requiredDataKeys: ['id', 'version', 'content', 'publishedBy', 'createdAt']
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
    requiresRequestBody: true,
    requiredDataKeys: ['id', 'groupId', 'totalAmount', 'currency', 'splits']
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
    requiresRequestBody: true,
    requiredDataKeys: ['id', 'groupId', 'payerUserId', 'payeeUserId', 'amount', 'currency']
  },
  {
    path: '/api/v1/groups/{groupId}/balances',
    method: 'get',
    statusCodes: ['200', '401'],
    requiresAuth: true,
    requiredPathParams: ['groupId'],
    requiredDataKeys: ['groupId', 'balances']
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function assertOperationMetadata(operation: OpenApiOperation, contract: EndpointContract): void {
  if (typeof operation.summary !== 'string' || operation.summary.trim().length === 0) {
    throw new Error(
      `Missing operation summary in ${contract.method.toUpperCase()} ${contract.path}`
    );
  }

  if (!Array.isArray(operation.tags) || operation.tags.length === 0) {
    throw new Error(
      `Missing operation tags in ${contract.method.toUpperCase()} ${contract.path}`
    );
  }
}

function assertSuccessEnvelopeExample(
  example: unknown,
  context: { method: HttpMethod; path: string }
): Record<string, unknown> {
  const envelope = asRecord(example);
  if (!envelope) {
    throw new Error(
      `Missing success envelope example in ${context.method.toUpperCase()} ${context.path}`
    );
  }

  if (envelope.success !== true) {
    throw new Error(
      `Success example must include success=true in ${context.method.toUpperCase()} ${context.path}`
    );
  }

  const data = asRecord(envelope.data);
  if (!data) {
    throw new Error(
      `Success example must include object data in ${context.method.toUpperCase()} ${context.path}`
    );
  }

  const meta = asRecord(envelope.meta);
  if (!meta) {
    throw new Error(
      `Success example must include meta object in ${context.method.toUpperCase()} ${context.path}`
    );
  }

  if (typeof meta.requestId !== 'string' || meta.requestId.length === 0) {
    throw new Error(
      `Success example meta.requestId must be non-empty string in ${context.method.toUpperCase()} ${context.path}`
    );
  }

  if (typeof meta.timestamp !== 'string' || meta.timestamp.length === 0) {
    throw new Error(
      `Success example meta.timestamp must be non-empty string in ${context.method.toUpperCase()} ${context.path}`
    );
  }

  return data;
}

function assertListQueryParamContracts(
  queryParams: OpenApiParameter[],
  contract: ListEndpointContract
): void {
  const context = `${contract.method.toUpperCase()} ${contract.path}`;

  const pageParam = queryParams.find((parameter) => parameter.name === 'page');
  const pageSizeParam = queryParams.find((parameter) => parameter.name === 'pageSize');
  const sortOrderParam = queryParams.find((parameter) => parameter.name === 'sortOrder');

  if (!pageParam || pageParam.schema?.minimum !== 1 || pageParam.schema?.example !== 1) {
    throw new Error(
      `Query parameter "page" must include minimum=1 and example=1 in ${context}`
    );
  }

  if (
    !pageSizeParam ||
    pageSizeParam.schema?.minimum !== 1 ||
    pageSizeParam.schema?.maximum !== 100 ||
    pageSizeParam.schema?.example !== 20
  ) {
    throw new Error(
      `Query parameter "pageSize" must include minimum=1, maximum=100, example=20 in ${context}`
    );
  }

  if (!sortOrderParam || !Array.isArray(sortOrderParam.schema?.enum)) {
    throw new Error(`Query parameter "sortOrder" must include enum values in ${context}`);
  }

  const sortOrderValues = [...sortOrderParam.schema.enum].map((value) => String(value)).sort();
  const expectedSortOrderValues = [...REQUIRED_SORT_ORDER_VALUES].sort();
  if (sortOrderValues.join(',') !== expectedSortOrderValues.join(',')) {
    throw new Error(
      `Query parameter "sortOrder" must be enum=[asc,desc] in ${context}`
    );
  }
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

    assertOperationMetadata(operation, contract);
    assertHasExpectedStatusCodes(responses, contract);
    assertAuthContract(operation, contract);
    assertPathParams(operation, contract);
    assertRequestBodyContract(operation, contract);

    const successStatusCode =
      contract.successStatusCode ?? contract.statusCodes.find((statusCode) => statusCode.startsWith('2'));
    if (!successStatusCode) {
      throw new Error(
        `Missing success status code definition in ${contract.method.toUpperCase()} ${contract.path}`
      );
    }

    const successResponse = responses[successStatusCode];
    const data = assertSuccessEnvelopeExample(
      successResponse?.content?.['application/json']?.schema?.example,
      {
        method: contract.method,
        path: contract.path
      }
    );

    for (const key of contract.requiredDataKeys ?? []) {
      if (!(key in data)) {
        throw new Error(
          `${successStatusCode} response example must include "${key}" in ${contract.method.toUpperCase()} ${contract.path}`
        );
      }
    }
  }
}

function assertOpenApiListContracts(document: OpenApiDocument): void {
  for (const contract of LIST_ENDPOINT_CONTRACTS) {
    const operation = getOperation(document, contract.method, contract.path);
    assertOperationMetadata(operation, {
      path: contract.path,
      method: contract.method,
      statusCodes: contract.statusCodes,
      requiresAuth: true
    });

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

    assertListQueryParamContracts(queryParams, contract);

    const responses = operation.responses ?? {};
    assertHasExpectedStatusCodes(responses, {
      path: contract.path,
      method: contract.method,
      statusCodes: contract.statusCodes,
      requiresAuth: true
    });

    const successResponse = responses['200'];
    const data = assertSuccessEnvelopeExample(
      successResponse?.content?.['application/json']?.schema?.example,
      {
        method: contract.method,
        path: contract.path
      }
    );
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

function assertOpenApiAggregateContracts(document: OpenApiDocument): void {
  for (const contract of AGGREGATE_ENDPOINT_CONTRACTS) {
    const operation = getOperation(document, contract.method, contract.path);
    assertOperationMetadata(operation, {
      path: contract.path,
      method: contract.method,
      statusCodes: contract.statusCodes,
      requiresAuth: true
    });

    const responses = operation.responses ?? {};
    assertHasExpectedStatusCodes(responses, {
      path: contract.path,
      method: contract.method,
      statusCodes: contract.statusCodes,
      requiresAuth: true
    });

    const successResponse = responses['200'];
    const data = assertSuccessEnvelopeExample(
      successResponse?.content?.['application/json']?.schema?.example,
      {
        method: contract.method,
        path: contract.path
      }
    );

    for (const key of contract.requiredDataKeys) {
      if (!asRecord(data[key])) {
        throw new Error(
          `200 response example must include object "${key}" in ${contract.method.toUpperCase()} ${contract.path}`
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
    assertOpenApiAggregateContracts(generatedDocument);

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
