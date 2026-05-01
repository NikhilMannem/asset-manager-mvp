import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.post("/fields", async (req, res) => {
  const tenantId = req.header("x-tenant-id");
  const fields = req.body.fields;

  if (!tenantId) {
    return res.status(400).json({ error: "Missing tenant id" });
  }
  if (!Array.isArray(fields)) {
    return res.status(400).json({ error: "fields must be an array" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]
    );

    // reset existing schema
    await client.query(
      "DELETE FROM asset_fields WHERE tenant_id = $1",
      [tenantId]
    );

    for (const f of fields) {
      await client.query(
        `
        INSERT INTO asset_fields (tenant_id, name, type, required)
        VALUES ($1, $2, $3, $4)
        `,
        [tenantId, f.name, f.type, f.required || false]
      );
    }

    await client.query("COMMIT");

    res.json({ message: "Fields saved" });

  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
router.get("/fields", async (req, res) => {
  const tenantId = req.header("x-tenant-id");
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT name, type, required FROM asset_fields WHERE tenant_id = $1",
      [tenantId]
    );
    res.json(result.rows);
  } finally {
    client.release();
  }
});

export default router;