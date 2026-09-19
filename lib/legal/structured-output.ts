import { jsonSchema, zodSchema } from 'ai';
import type { z } from 'zod';

/** Keep full runtime validation without expanding provider array grammars. */
export function legalOutputSchema<T>(schema: z.ZodType<T>) {
  const original = zodSchema(schema);
  return jsonSchema<T>(async () => {
    const wire = JSON.parse(JSON.stringify(await original.jsonSchema));
    const visit = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(visit); return; }
      const item = node as Record<string, unknown>;
      if (item.type === 'array') {
        delete item.minItems;
        delete item.maxItems;
      }
      Object.values(item).forEach(visit);
    };
    visit(wire);
    return wire;
  }, { validate: original.validate });
}
