import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";

// Middlewares
import { tenantMiddleware } from "./middleware/tenant.js";

// Routers
import uploadRouter from "./routes/upload.js";
import stagedRouter from "./routes/staged.js";
import commitRouter from "./routes/commit.js";
import seedRouter from "./routes/seed.js";
import fieldsRouter from "./routes/fields.js";
import assetsRouter from "./routes/assets.js";
import tenantsRouter from "./routes/tenants.js"; // Your new router!

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 🔓 PUBLIC ROUTES (No Tenant ID Required)
// ==========================================
// We put this BEFORE the middleware so users can log in and create workspaces!
app.use(tenantsRouter);


// ==========================================
// 🛡️ THE WALL (Middleware)
// ==========================================
// Everything below this line REQUIRES the x-tenant-id header
app.use(tenantMiddleware);


// ==========================================
// 🔒 PROTECTED ROUTES
// ==========================================
app.use(uploadRouter);
app.use(stagedRouter);
app.use(commitRouter);
app.use(seedRouter);
app.use(fieldsRouter);
app.use(assetsRouter);

// The standalone GET /assets route from your original setup
app.get("/assets", async (req, res) => {
  const tenantId = (req as any).tenantId; 
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // Set the tenant context for RLS
    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]
    );
    
    const result = await client.query("SELECT * FROM assets");
    await client.query("COMMIT");
    
    res.json(result.rows);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to fetch assets" });
  } finally {
    client.release();
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});