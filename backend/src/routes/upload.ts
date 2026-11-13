import { Router } from "express";
import multer from "multer";
import fs from "fs";
import csv from "csv-parser";
import { pool } from "../db.js";
import { type PoolClient } from "pg";
import { getDynamicSchema } from "../utils/schemaBuilder.js";

const router = Router();

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

router.post("/upload", upload.single("file"), async (req, res) => {
  console.log("TENANT HEADER:", req.header("x-tenant-id"));

  const tenantId = req.header("x-tenant-id");

  if (!tenantId) {
    return res.status(400).json({
      error: "Missing tenant header",
    });
  }

  if (!req.file) {
    return res.status(400).json({
      error: "No file uploaded",
    });
  }

  const client = await pool.connect();

  try {
    /*
     * 1. Start transaction
     */
    await client.query("BEGIN");

    /*
     * 2. Set tenant context for PostgreSQL RLS
     */
    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]
    );

    /*
     * 3. Load the tenant-specific Zod schema
     */
    const dynamicSchema = await getDynamicSchema(
      client,
      tenantId
    );

    /*
     * 4. Get the allowed CSV column names
     */
    const allowedFields = Object.keys(
      dynamicSchema.shape
    );

    const stream = fs
      .createReadStream(req.file.path)
      .pipe(csv());

    let batch: any[] = [];
    let validCount = 0;
    let invalidCount = 0;

    /*
     * 5. Process the CSV as a stream
     */
    for await (const row of stream) {
      /*
       * Keep only configured fields.
       *
       * Example:
       * Configured fields: name, price, color
       *
       * CSV columns:
       * name, price, color, randomColumn
       *
       * randomColumn will be ignored.
       */
      const cleanedRow: Record<string, unknown> = {};

      for (const key of Object.keys(row)) {
        if (allowedFields.includes(key)) {
          cleanedRow[key] = row[key];
        }
      }

      /*
       * 6. Validate the cleaned row using the dynamic schema
       */
      const result = dynamicSchema.safeParse(cleanedRow);

      /*
       * 7. Store both original/cleaned data and normalized data
       */
      batch.push({
        row: cleanedRow,

        valid: result.success,

        errors: result.success
          ? null
          : result.error.issues,

        validatedData: result.success
          ? result.data
          : null,
      });

      if (result.success) {
        validCount++;
      } else {
        invalidCount++;
      }

      /*
       * 8. Insert in batches of 500
       */
      if (batch.length === 500) {
        await insertBatch(client, tenantId, batch);
        batch = [];
      }
    }

    /*
     * 9. Insert remaining rows
     */
    if (batch.length > 0) {
      await insertBatch(client, tenantId, batch);
    }

    /*
     * 10. Commit transaction
     */
    await client.query("COMMIT");

    /*
     * 11. Delete temporary uploaded file
     */
    fs.unlink(req.file.path, (err) => {
      if (err) {
        console.error(
          "Failed to delete temp file:",
          err
        );
      }
    });

    /*
     * 12. Send response
     */
    return res.json({
      message: "Upload complete",
      validCount,
      invalidCount,
    });
  } catch (err) {
    console.error("FULL ERROR:", err);

    /*
     * Roll back database changes
     */
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Rollback failed:",
        rollbackError
      );
    }

    /*
     * Delete temporary file on failure
     */
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }

    return res.status(500).json({
      error: "Upload failed",
      details:
        err instanceof Error
          ? err.message
          : String(err),
    });
  } finally {
    client.release();
  }
});

/*
 * Inserts staged rows in bulk.
 */
async function insertBatch(
  client: PoolClient,
  tenantId: string,
  batch: any[]
) {
  const values: any[] = [];
  const placeholders: string[] = [];

  batch.forEach((item: any, i: number) => {
    const idx = i * 5;

    placeholders.push(
      `($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5})`
    );

    values.push(
      tenantId,

      // Original cleaned CSV values
      JSON.stringify(item.row),

      // Validation errors, if any
      item.errors
        ? JSON.stringify(item.errors)
        : null,

      // true or false
      item.valid,

      // Zod-normalized data
      item.validatedData
        ? JSON.stringify(item.validatedData)
        : null
    );
  });

  await client.query(
    `
    INSERT INTO staged_assets
      (
        tenant_id,
        raw_data,
        errors,
        is_valid,
        validated_data
      )
    VALUES ${placeholders.join(",")}
    `,
    values
  );
}

export default router;