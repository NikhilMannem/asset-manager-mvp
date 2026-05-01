import { Router } from "express";
import { pool } from "../db.js";
import { getDynamicSchema } from "../utils/schemaBuilder.js";

const router = Router();

// 🔹 GET invalid rows
router.get("/staged/invalid", async (req, res) => {
  const tenantId = req.header("x-tenant-id");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]
    );

    const result = await client.query(`
      SELECT id, raw_data, errors
      FROM staged_assets
      WHERE is_valid = false AND processed = false
    `);

    await client.query("COMMIT");

    res.json(result.rows);

  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to fetch" });
  } finally {
    client.release();
  }
});

// 🔹 FIX row
router.patch("/staged/:id", async (req, res) => {
  const { id } = req.params;
  const tenantId = req.header("x-tenant-id") as string;
  const newData = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]
    );

    // Grab the dynamic schema and validate the incoming edits
    const dynamicschema = await getDynamicSchema(client, tenantId);
    const result = dynamicschema.safeParse(newData);

    await client.query(`
      UPDATE staged_assets
      SET 
        raw_data = $1,
        is_valid = $2,
        errors = $3
      WHERE id = $4
    `, [
      JSON.stringify(newData),
      result.success,
      result.success ? null : JSON.stringify(result.error.issues),
      id
    ]);

    await client.query("COMMIT");

    res.json({ message: "Row updated", valid: result.success });

  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Update failed", details: String(err) });
  } finally {
    client.release();
  }
});
export default router;