import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Endpoint tidak ditemukan" });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validasi gagal", issues: err.issues });
  }
  const message = err instanceof Error ? err.message : "Internal error";
  console.error("[error]", err);
  res.status(500).json({ error: message });
}
