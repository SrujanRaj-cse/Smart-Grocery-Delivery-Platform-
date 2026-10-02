import { randomUUID } from "node:crypto";

export default function requestId(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}
