import type { PaginationMeta } from '../../../common/http/pagination';

export interface ContractSummary {
  id: string;
  groupId: string;
  draftContent: string;
  publishedVersion: number | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractVersionSummary {
  id: string;
  version: number;
  content: string;
  publishedBy: string;
  createdAt: string;
}

export interface ContractDetailResponse {
  contract: ContractSummary;
  latestPublishedContent: string | null;
}

export interface ContractVersionsResponse {
  groupId: string;
  versions: ContractVersionSummary[];
  pagination: PaginationMeta;
}
