import type { Request, Response, NextFunction } from "express";

export function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const tenantId = req.header("x-tenant-id");

  if (!tenantId) {
    return res.status(400).json({
      error: "Tenant header missing",
    });
  }
  
  // Just attach the ID so downstream routes can use it
  (req as any).tenantId = tenantId;
  next();
}