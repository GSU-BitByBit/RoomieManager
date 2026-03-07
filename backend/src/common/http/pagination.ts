import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  type PaginationQueryDto
} from './dto/pagination-query.dto';

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function resolvePagination(query?: PaginationQueryDto): PaginationParams {
  const page = normalizePositiveInteger(query?.page, DEFAULT_PAGE);
  const pageSize = normalizePositiveInteger(query?.pageSize, DEFAULT_PAGE_SIZE);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

export function buildPaginationMeta(
  page: number,
  pageSize: number,
  totalItems: number
): PaginationMeta {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: totalPages > 0 && page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0
  };
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const integer = Math.floor(value);
  return integer > 0 ? integer : fallback;
}
