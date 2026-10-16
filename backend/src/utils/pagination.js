import { PAGINATION } from '../config/constants.js';

export function buildPagination({ page = 1, limit = PAGINATION.DEFAULT_LIMIT } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || PAGINATION.DEFAULT_LIMIT, 1), PAGINATION.MAX_LIMIT);
  const safePage = Math.max(Number(page) || 1, 1);
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

export function paginationMeta({ page, limit }, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

/**
 * "-date,slotStart" -> { date: -1, slotStart: 1, _id: 1 }.
 * `allowed` maps public sort keys to database fields, so clients cannot sort on arbitrary
 * (possibly unindexed) fields. `_id` is appended as a tie-breaker for stable pagination.
 *
 * @param {string | undefined} sort
 * @param {Record<string, string>} allowed
 * @param {Record<string, 1 | -1>} fallback
 */
export function buildSort(sort, allowed, fallback) {
  const result = {};
  for (const token of String(sort ?? '').split(',')) {
    const trimmed = token.trim();
    const field = allowed[trimmed.replace(/^-/, '')];
    if (field) result[field] = trimmed.startsWith('-') ? -1 : 1;
  }
  return { ...(Object.keys(result).length ? result : fallback), _id: 1 };
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
