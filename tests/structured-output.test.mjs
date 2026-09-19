import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { legalOutputSchema } from '../lib/legal/structured-output.ts';

test('provider grammar stays small while runtime rejects out-of-bounds findings', async () => {
  const schema = legalOutputSchema(z.object({ findings: z.array(z.object({ risk: z.enum(['high', 'low']) })).min(1).max(2) }));
  const wire = await schema.jsonSchema;
  assert.equal(wire.properties.findings.maxItems, undefined);
  assert.equal(wire.properties.findings.minItems, undefined);
  assert.deepEqual(wire.properties.findings.items.properties.risk.enum, ['high', 'low']);
  assert.equal((await schema.validate({ findings: [{ risk: 'high' }] })).success, true);
  assert.equal((await schema.validate({ findings: [] })).success, false);
  assert.equal((await schema.validate({ findings: Array(3).fill({ risk: 'high' }) })).success, false);
  assert.equal((await schema.validate({ findings: [{ risk: 'invented' }] })).success, false);
});
