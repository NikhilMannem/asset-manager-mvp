import { Router } from "express";
import { pool } from "../db.js";
import { getDynamicSchema } from "../utils/schemaBuilder.js";
const router = Router();

/* ================= CREATE MANUAL ASSET ================= */

router.post("/assets/manual", async (req, res) => {
  const tenantId = req.header("x-tenant-id");
  const data = req.body;

  if (!tenantId) {
    return res.status(400).json({
      error: "Missing tenant id",
    });
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return res.status(400).json({
      error: "Request body must be an object",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]
    );

    const dynamicSchema = await getDynamicSchema(
      client,
      tenantId
    );

    const validationResult = dynamicSchema.safeParse(data);

    if (!validationResult.success) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const validatedData = validationResult.data;

    const name = validatedData.name;

    if (typeof name !== "string" || name.trim() === "") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "The name field is required and must be a string",
      });
    }

    const attributes = {
      ...validatedData,
    };

    delete attributes.name;

    await client.query(
      `
      INSERT INTO assets (tenant_id, name, attributes)
      VALUES ($1, $2, $3)
      `,
      [
        tenantId,
        name,
        JSON.stringify(attributes),
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Asset added",
      asset: {
        name,
        attributes,
      },
    });
  } catch (err: any) {
    await client.query("ROLLBACK");

    return res.status(500).json({
      error: err.message,
    });
  } finally {
    client.release();
  }
});

/* ================= UPDATE ASSET ================= */

router.patch("/assets/:id", async (req, res) => {
  const tenantId = req.header("x-tenant-id");
  const { id } = req.params;
  const data = req.body;

  if (!tenantId) {
    return res.status(400).json({
      error: "Missing tenant id",
    });
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return res.status(400).json({
      error: "Request body must be an object",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]
    );

    const existingResult = await client.query(
      `
      SELECT id, name, attributes
      FROM assets
      WHERE id = $1
      `,
      [id]
    );

    if (existingResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Asset not found",
      });
    }

    const existingAsset = existingResult.rows[0];

    const existingData = {
      name: existingAsset.name,
      ...(existingAsset.attributes || {}),
    };

    const mergedData = {
      ...existingData,
      ...data,
    };

    const dynamicSchema = await getDynamicSchema(
      client,
      tenantId
    );

    const validationResult = dynamicSchema.safeParse(
      mergedData
    );

    if (!validationResult.success) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const validatedData = validationResult.data;

    const name = validatedData.name;

    if (typeof name !== "string" || name.trim() === "") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "The name field is required and must be a string",
      });
    }

    const attributes = {
      ...validatedData,
    };

    delete attributes.name;

    const updateResult = await client.query(
      `
      UPDATE assets
      SET name = $1,
          attributes = $2
      WHERE id = $3
      RETURNING id, tenant_id, name, attributes
      `,
      [
        name,
        JSON.stringify(attributes),
        id,
      ]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Updated",
      asset: updateResult.rows[0],
    });
  } catch (err: any) {
    await client.query("ROLLBACK");

    return res.status(500).json({
      error: err.message,
    });
  } finally {
    client.release();
  }
});

/* ================= DELETE ASSET ================= */

router.delete("/assets/:id", async (req, res) => {
  const tenantId = req.header("x-tenant-id");
  const { id } = req.params;

  if (!tenantId) {
    return res.status(400).json({
      error: "Missing tenant id",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]
    );

    const deleteResult = await client.query(
      `
      DELETE FROM assets
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (deleteResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Asset not found",
      });
    }

    await client.query("COMMIT");

    return res.json({
      message: "Deleted",
    });
  } catch (err: any) {
    await client.query("ROLLBACK");

    return res.status(500).json({
      error: err.message,
    });
  } finally {
    client.release();
  }
});

export default router;