import * as z from "zod";

export type AssetField = {
  name: string;
  type: string;
  required: boolean;
};

function validatorForType(type: string) {
  switch (type) {
    case "string":
      return z.string();

    case "number":
      return z.coerce.number();

    case "boolean":
      return z.preprocess((value) => {
        if (typeof value === "boolean") return value;

        if (typeof value === "string") {
          const normalized = value.trim().toLowerCase();

          if (normalized === "true") return true;
          if (normalized === "false") return false;
        }

        return value;
      }, z.boolean());

    case "date":
      return z.string().date();

    case "email":
      return z.string().email();

    default:
      throw new Error(`Unsupported field type: ${type}`);
  }
}

export function buildAssetSchema(fields: AssetField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let validator: z.ZodTypeAny = validatorForType(field.type);

    if (!field.required) {
      validator = validator.optional();
    }

    shape[field.name] = validator;
  }

  return z.object(shape).strict();
}