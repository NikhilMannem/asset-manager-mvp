import { z } from "zod";

export const schema = z.object({
  name: z.string().min(1),
  price: z.coerce.number() //there is no date here, add it if you want it. it is used in upload.ts
});