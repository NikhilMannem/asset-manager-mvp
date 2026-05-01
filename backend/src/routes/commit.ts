import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.post("/staged/commit", async (req, res) => {
  const tenantId = req.header("x-tenant-id");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]
    );

    const result = await client.query(`
      INSERT INTO assets (tenant_id, name, attributes)
      SELECT 
        tenant_id,
        raw_data->>'name',
        raw_data - 'name'
      FROM staged_assets
      WHERE is_valid = true AND processed = false
      RETURNING id;
    `);

    await client.query(`
      UPDATE staged_assets
      SET processed = true
      WHERE is_valid = true AND processed = false;
    `);

    await client.query("COMMIT");

    res.json({
      message: "Committed successfully",
      inserted: result.rowCount
    });

  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Commit failed", details: String(err) });
  } finally {
    client.release();
  }
});

export default router;