import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.post("/assets/manual", async (req, res) => {
  const tenantId = req.header("x-tenant-id");
  const data = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]
    );

    const name = data.name;
    const attributes = { ...data };
    delete attributes.name;

    await client.query(
      `
      INSERT INTO assets (tenant_id, name, attributes)
      VALUES ($1, $2, $3)
      `,
      [tenantId, name, JSON.stringify(attributes)]
    );

    await client.query("COMMIT");

    res.json({ message: "Asset added" });

  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ================= UPDATE ================= */
router.patch("/assets/:id", async (req, res) => {
  const tenantId = req.header("x-tenant-id");
  const { id } = req.params;
  const data = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]
    );

    const name = data.name;
    const attributes = { ...data };
    delete attributes.name;

    await client.query(
      `UPDATE assets SET name=$1, attributes=$2 WHERE id=$3`,
      [name, JSON.stringify(attributes), id]
    );

    await client.query("COMMIT");

    res.json({ message: "Updated" });

  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ================= DELETE ================= */
router.delete("/assets/:id", async (req, res) => {
  const tenantId = req.header("x-tenant-id");
  const { id } = req.params;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]
    );

    await client.query(
      `DELETE FROM assets WHERE id=$1`,
      [id]
    );

    await client.query("COMMIT");

    res.json({ message: "Deleted" });

  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;