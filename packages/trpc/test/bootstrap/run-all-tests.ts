import { createTRPCProxyClient } from '@trpc/client';
import type { AppRouter } from './router';
import { chromeLink } from '@cyia/chrome-trpc/client';

interface TestResult {
  path: string;
  success: boolean;
  error?: string;
  expected?: any;
  actual?: any;
}

function compareUint8(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function compare(actual: unknown, expected: unknown): boolean {
  if (actual instanceof Uint8Array && expected instanceof Uint8Array) {
    return compareUint8(actual, expected);
  }
  return JSON.stringify(actual) === JSON.stringify(expected);
}

interface TestCase {
  path: string;
  fn: () => Promise<unknown>;
  expected: unknown;
}

async function runTest(testCase: TestCase): Promise<TestResult> {
  try {
    const actual = await testCase.fn();
    return {
      path: testCase.path,
      success: compare(actual, testCase.expected),
    };
  } catch (e) {
    return {
      path: testCase.path,
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function runAll(port: chrome.runtime.Port): Promise<TestResult[]> {
  const trpc = createTRPCProxyClient<AppRouter>({
    links: [chromeLink({ port: port })],
  });
  return Promise.all([
    runTest({ path: 'hello', fn: () => trpc.hello.query(), expected: 'word' }),
    runTest({
      path: 'input1',
      fn: () => trpc.input1.query({ a1: 'test-value' }),
      expected: 'word-test-value',
    }),
    runTest({ path: 'r1.r2', fn: () => trpc.r1.r2.query(), expected: 'word' }),
    runTest({
      path: 'cmp1',
      fn: () => trpc.cmp1.query(),
      expected: { arr1: [1, 2, 3], num1: 1, str1: '1', b1: true },
    }),
    runTest({
      path: 'cmp2.cmp1',
      fn: () => trpc.cmp2.cmp1.query(),
      expected: { arr1: [1, 2, 3], num1: 1, str1: '1', b1: true },
    }),
    runTest({
      path: 'cmp3',
      fn: () => trpc.cmp3.query(),
      expected: new Uint8Array([1, 2, 3, 4]),
    }),
    runTest({
      path: 'cmp4.cmp3',
      fn: () => trpc.cmp4.cmp3.query(),
      expected: new Uint8Array([1, 2, 3, 4]),
    }),
    runTest({
      path: 'client',
      fn: () =>
        trpc.clientCmp.query({ arr1: [1, 2, 3], num1: 1, str1: '1', b1: true }),
      expected: true,
    }),
    runTest({
      path: 'clientCmp',
      fn: () =>
        trpc.clientCmp.query(
          { arr1: [1, 2, 3], num1: 1, str1: '1', b1: true },
          { context: { compress: true } },
        ),
      expected: true,
    }),
    runTest({
      path: 'clientUint8',
      fn: () => trpc.clientCmpUint8.query(new Uint8Array([1, 2, 3, 4])),
      expected: new Uint8Array([1, 2, 3, 4]),
    }),
    runTest({
      path: 'clientCmpUint8',
      fn: () =>
        trpc.clientCmpUint8.query(new Uint8Array([1, 2, 3, 4]), {
          context: { compress: true },
        }),
      expected: new Uint8Array([1, 2, 3, 4]),
    }),
    runTest({
      path: 'queryObjectWithUint8Array',
      fn: () =>
        trpc.queryObjectWithUint8Array.query({
          str1: '11',
          arr1: new Uint8Array([1, 2, 3, 4]),
        }),
      expected: { str1: '11', arr1: new Uint8Array([1, 2, 3, 4]) },
    }),
    runTest({
      path: 'queryObjectWithUint8ArrayCmp',
      fn: () =>
        trpc.queryObjectWithUint8Array.query(
          { str1: '11', arr1: new Uint8Array([1, 2, 3, 4]) },
          { context: { compress: true } },
        ),
      expected: { str1: '11', arr1: new Uint8Array([1, 2, 3, 4]) },
    }),
    runTest({
      path: 'res.cmp',
      fn: () => trpc.res.cmp.query(),
      expected: new Uint8Array([1, 2, 3, 4]),
    }),
    runTest({
      path: 'ctxValue1',
      fn: () => trpc.ctxValue1.query(),
      expected: '123',
    }),
  ]);
}
