import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.post("/seed-data", async (req, res) => {
  const tenantId = req.header("x-tenant-id");

  if (!tenantId) {
    return res.status(400).json({ error: "Missing tenant id" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔥 Activate RLS
    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]
    );

    // 🧪 Sample rows (mix of valid + invalid)
    const sampleData = [
      { name: "Laptop", price: 1000, color: "black" },
      { name: "Phone", price: "abc", color: "white" }, // invalid
      { name: "Tablet", price: 500 }
    ];

    for (const row of sampleData) {
      const isValid = typeof row.price === "number";

      await client.query(
        `
        INSERT INTO staged_assets (tenant_id, raw_data, is_valid, errors, processed)
        VALUES ($1, $2, $3, $4, false)
        `,
        [
          tenantId,
          JSON.stringify(row),
          isValid,
          isValid ? null : JSON.stringify([{ field: "price", message: "Must be number" }])
        ]
      );
    }

    await client.query("COMMIT");

    res.json({ message: "Sample data inserted" });

  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Seed failed", details: err.message });
  } finally {
    client.release();
  }
});

export default router;