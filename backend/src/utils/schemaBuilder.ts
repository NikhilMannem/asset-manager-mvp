import * as z from "zod";
import { type PoolClient } from "pg";

export async function getDynamicSchema(client: PoolClient, tenantId: string) {
  const fieldsRes = await client.query(
    "SELECT name, type, required FROM asset_fields WHERE tenant_id = $1",
    [tenantId]
  );

  if (fieldsRes.rows.length === 0) {
    throw new Error("No schema defined for tenant");
  }

  const shape: any = {};

  for (const f of fieldsRes.rows) {
    let validator;
    if (f.type === "string") validator = z.string();
    else if (f.type === "number") validator = z.coerce.number();
    else validator = z.any();

    if (!f.required) validator = validator.optional();

    shape[f.name] = validator;
  }

  return z.object(shape);
}