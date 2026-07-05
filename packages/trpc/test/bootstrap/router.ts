import { initTRPC } from '@trpc/server';
import * as v from 'valibot';
const t = initTRPC.context<{ ctxValue: string }>().create({ isServer: true });

export const appRouter = t.router({
  hello: t.procedure.query(() => 'word'),
  input1: t.procedure
    .input(v.object({ a1: v.string() }))
    .query((opts) => `word-${opts.input.a1}`),
  r1: t.router({
    r2: t.procedure.query(() => 'word'),
  }),
  cmp1: t.procedure.query(() => ({
    arr1: [1, 2, 3],
    num1: 1,
    str1: '1',
    b1: true,
  })),
  cmp2: t.router({
    cmp1: t.procedure.query(() => ({
      arr1: [1, 2, 3],
      num1: 1,
      str1: '1',
      b1: true,
    })),
  }),
  cmp3: t.procedure.query(() => new Uint8Array([1, 2, 3, 4])),
  cmp4: t.router({
    cmp3: t.procedure.query(() => new Uint8Array([1, 2, 3, 4])),
  }),
  clientCmp: t.procedure
    .input(
      v.object({
        arr1: v.array(v.number()),
        num1: v.number(),
        str1: v.string(),
        b1: v.boolean(),
      }),
    )
    .query(({ input }) => true),
  clientCmpUint8: t.procedure
    .input(v.custom((a) => a instanceof Uint8Array))
    .query(({ input }) => input),
  getResult: t.procedure
    .input(v.object({ path: v.string(), value: v.any() }))
    .query(({ input }) => {}),
  queryObjectWithUint8Array: t.procedure
    .input(
      v.object({
        str1: v.string(),
        arr1: v.custom((a) => a instanceof Uint8Array),
      }),
    )
    .query(({ input }) => input),
  res: t.router({
    cmp: t.procedure.query(() => new Uint8Array([1, 2, 3, 4])),
  }),
  ctxValue1: t.procedure.query(({ ctx }) => ctx.ctxValue),
});

export type AppRouter = typeof appRouter;
