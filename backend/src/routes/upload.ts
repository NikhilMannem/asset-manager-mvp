import { Router } from "express";
import { type Request } from "express";
import multer from "multer";
import fs from "fs";
import csv from "csv-parser";
import * as z from "zod";
import { pool } from "../db.js";
import { type PoolClient } from "pg";
import { getDynamicSchema } from "../utils/schemaBuilder.js";

type MulterRequest = Request & {
  file: Express.Multer.File;
};

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
    return res.status(400).json({ error: "Missing tenant header" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // 1. Grab the client
  const client = await pool.connect();

  let dynamicschema;
  try {
    // Generate the dynamic schema from the database BEFORE the main transaction
    dynamicschema = await getDynamicSchema(client, tenantId);
  } catch (err: any) {
    client.release();
    // Clean up temp file on early exit
    if (req.file && req.file.path) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: err.message });
  }

  // 2. Start the master try/catch block
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]
    );

    const stream = fs.createReadStream(req.file.path).pipe(csv());

    let batch: any[] = [];
    let validCount = 0;
    let invalidCount = 0;

    // Extract allowed keys directly from the Zod schema shape
    const allowedFields = Object.keys(dynamicschema.shape);

    // Process the stream
    for await (const row of stream) {

      // 🔽 STEP 3.3 — CLEAN ROW (only allowed fields)
      const cleanedRow: any = {};
      for (const key of Object.keys(row)) {
        if (allowedFields.includes(key)) {
          cleanedRow[key] = row[key];
        }
      }

      // 🔽 STEP 3.4 — VALIDATE using dynamic schema
      const result = dynamicschema.safeParse(cleanedRow);

      // 🔽 STEP 3.5 — PREPARE FOR INSERT
      batch.push({
        row: cleanedRow,
        valid: result.success,
        errors: result.success ? null : result.error.issues,
      });

      if (result.success) validCount++;
      else invalidCount++;

      // 🔽 batch insert (unchanged)
      if (batch.length === 500) {
        await insertBatch(client, tenantId, batch);
        batch = [];
      }
    }

    // Insert any remaining rows
    if (batch.length > 0) {
      await insertBatch(client, tenantId, batch);
    }

    await client.query("COMMIT");

    // Clean up: Delete the temp file to save disk space
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Failed to delete temp file:", err);
    });

    // Send single success response
    res.json({
      message: "Upload complete",
      validCount,
      invalidCount,
    });

  } catch (err) {
    console.error("FULL ERROR:", err);
    
    // Rollback changes if anything goes wrong
    await client.query("ROLLBACK");

    // Clean up temp file on error as well
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {}); 
    }

    // Now Postman will actually receive the exact database error
    res.status(500).json({
      error: "Upload failed",
      details: err instanceof Error ? err.message : String(err)
    });

  } finally {
    // 3. CRITICAL: Always release the client back to the pool
    client.release();
  }
});

async function insertBatch(client: PoolClient, tenantId: string, batch: any[]) {
  const values: any[] = [];
  const placeholders: string[] = [];

  batch.forEach((item: any, i: number) => {
    const idx = i * 4;

    placeholders.push(
      `($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`
    );

    values.push(
      tenantId,
      JSON.stringify(item.row),
      JSON.stringify(item.errors),
      item.valid
    );
  });

  await client.query(
    `
    INSERT INTO staged_assets (tenant_id, raw_data, errors, is_valid)
    VALUES ${placeholders.join(",")}
    `,
    values
  );
}

export default router;