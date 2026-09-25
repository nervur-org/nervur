// api.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import * as desk from './desk.ts';
import { faculties } from './recipe.ts';

test('A person signs up at the face, and reaches their member as an API and as tools', async (t) => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'desk', modules: { desk }, registry: { faculties } });
  t.after(() => ground.down());
  await ground.hand({ faculty: 'faculties', method: 'add', args: { name: 'face', make: 'face' } });
  await ground.add('desk', 'desk', { faculties: ['face'] });
  await ground.ask({ house: 'desk', method: 'arm' });
  const web = async (path: string, body?: unknown, token?: string) =>
    (await ground.fetch(
      new Request(`https://desk.example${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    )).json() as Promise<Record<string, unknown>>;

  const { token } = (await web('/signup', { name: 'ada' })) as { token: string };
  const { describe } = (await web('/api', undefined, token)) as { describe: { asks: { method: string }[] } };
  assert.deepEqual(describe.asks.map(({ method }) => method).sort(), ['hello', 'leave', 'visit']);
  assert.deepEqual(await web('/api/hello', {}, token), { result: 'hello, member-ada' });
  assert.deepEqual(await web('/api/visit', {}, token), { result: 1 });

  const { result } = (await web('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' }, token)) as { result: { tools: { name: string; annotations: { readOnly?: boolean } }[] } };
  assert.equal(result.tools.find(({ name }) => name === 'hello')?.annotations.readOnly, true, 'a hint is an annotation');
  const called = await web('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'visit' } }, token);
  assert.deepEqual(called.result, { content: [{ type: 'text', text: '2' }], isError: false });

  assert.deepEqual(await web('/api/leave', {}, token), { result: null });
  assert.deepEqual(await web('/api/hello', {}, token), { error: { message: 'no such token' } }, 'a door let go is no door');
});
