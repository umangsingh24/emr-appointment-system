import { ApiError } from '../utils/ApiError.js';

const SOURCES = ['params', 'query', 'body'];

/**
 * Validates and coerces request input with Zod schemas.
 * Parsed values are exposed on `req.validated` (Express 5 makes `req.query` read-only),
 * so controllers only ever see sanitised, typed data.
 *
 * @param {{ params?: import('zod').ZodType, query?: import('zod').ZodType, body?: import('zod').ZodType }} schemas
 */
export function validate(schemas) {
  return (req, _res, next) => {
    const validated = {};
    const errors = [];

    for (const source of SOURCES) {
      const schema = schemas[source];
      if (!schema) continue;
      const result = schema.safeParse(req[source] ?? {});
      if (result.success) {
        validated[source] = result.data;
      } else {
        errors.push(
          ...result.error.issues.map((issue) => ({
            field: [source, ...issue.path].join('.'),
            message: issue.message,
          })),
        );
      }
    }

    if (errors.length) return next(ApiError.badRequest('Validation failed', errors));
    req.validated = validated;
    return next();
  };
}
