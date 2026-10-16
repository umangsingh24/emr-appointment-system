/** Request metadata passed into services for auditing (services never touch `req` directly). */
export function requestContext(req) {
  return {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };
}
