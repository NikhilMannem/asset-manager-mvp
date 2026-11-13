import * as z from "zod";
import { type PoolClient } from "pg";

type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "json";

type FieldDefinition = {
  name: string;
  type: FieldType;
  required: boolean;
};

/**
 * Converts empty CSV/manual input values into undefined.
 *
 * This is important because:
 * - "" should not count as a real optional value
 * - "" should not become 0 for a number
 * - "" should not fail a required field with a confusing error
 */
function emptyToUndefined(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

function booleanPreprocessor(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "") {
    return undefined;
  }

  if (["true", "1", "yes"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  // Return the original invalid value.
  // z.boolean() will then reject it.
  return value;
}

/**
 * Converts a JSON string into an actual JavaScript value.
 *
 * Example:
 * '{"ram":"16GB"}' -> { ram: "16GB" }
 */
function jsonPreprocessor(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  if (value.trim() === "") {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Creates a Zod validator for one configured field.
 */
function createFieldValidator(field: FieldDefinition): z.ZodTypeAny {
  let validator: z.ZodTypeAny;

  switch (field.type) {
    case "string":
      validator = z.preprocess(
        emptyToUndefined,
        z.string().trim()
      );
      break;

    case "number":
      validator = z.preprocess(
        emptyToUndefined,
        z.coerce.number().finite()
      );
      break;

    case "boolean":
      validator = z.preprocess(
        booleanPreprocessor,
        z.boolean()
      );
      break;

    case "date":
      validator = z.preprocess(
        emptyToUndefined,
        z.iso.date()
      );
      break;

    case "json":
      validator = z.preprocess(
        jsonPreprocessor,
        z.unknown().refine(
          (value) => {
            // undefined is handled below if the field is optional.
            if (value === undefined) {
              return true;
            }

            // JSON.parse can return these valid JSON values:
            // object, array, string, number, boolean, null.
            return (
              value === null ||
              typeof value === "object" ||
              typeof value === "string" ||
              typeof value === "number" ||
              typeof value === "boolean"
            );
          },
          {
            message: "Value must contain valid JSON",
          }
        )
      );
      break;

    default:
      throw new Error(
        `Unsupported field type: ${field.type}`
      );
  }

  if (!field.required) {
    validator = validator.optional();
  }

  return validator;
}

/**
 * Builds a strict Zod schema from the tenant's field definitions.
 * strict() rejects CSV/manual fields that were not configured
 * in asset_fields.
 */
export function buildDynamicSchema(
  fields: FieldDefinition[]
) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    shape[field.name] = createFieldValidator(field);
  }

  return z.object(shape).strict();
}

/**
 * Loads the tenant's field definitions from PostgreSQL and builds its dynamic Zod schema.
 */
export async function getDynamicSchema(
  client: PoolClient,
  tenantId: string
) {
  const fieldsRes = await client.query(
    `
    SELECT name, type, required
    FROM asset_fields
    WHERE tenant_id = $1
    ORDER BY id
    `,
    [tenantId]
  );

  if (fieldsRes.rows.length === 0) {
    throw new Error("No schema defined for tenant");
  }

  const fields = fieldsRes.rows as FieldDefinition[];

  return buildDynamicSchema(fields);
}

/**
 * Loads the field definitions themselves.
 * This is useful when we need to know which field is "name"
 * and which fields belong inside the JSONB attributes object.
 */
export async function getFieldDefinitions(
  client: PoolClient,
  tenantId: string
): Promise<FieldDefinition[]> {
  const fieldsRes = await client.query(
    `
    SELECT name, type, required
    FROM asset_fields
    WHERE tenant_id = $1
    ORDER BY id
    `,
    [tenantId]
  );

  if (fieldsRes.rows.length === 0) {
    throw new Error("No schema defined for tenant");
  }

  return fieldsRes.rows as FieldDefinition[];
} 