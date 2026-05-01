import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

// Create new tenant
router.post("/tenants", async (req, res) => {
  const { name } = req.body;

  const client = await pool.connect();

  try {
    const result = await client.query(
      `
      INSERT INTO tenants (name)
      VALUES ($1)
      RETURNING id, name
      `,
      [name]
    );

    res.json(result.rows[0]);

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Get all tenants
router.get("/tenants", async (req, res) => {
  const result = await pool.query("SELECT * FROM tenants");
  res.json(result.rows);
});

export default router;