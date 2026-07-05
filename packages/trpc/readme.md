# @cyia/chrome-trpc

[English](./readme.md) | [中文](./readme.zh-hans.md)

[![npm version](https://badge.fury.io/js/%40cyia%2Fchrome-trpc.svg)](https://badge.fury.io/js/%40cyia%2Fchrome-trpc)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A **tRPC adapter** tailored for Chrome extensions, enabling you to make type-safe remote procedure calls securely and conveniently between different extension contexts (popup, content script, background).  
It deeply integrates Chrome’s internal `runtime.connect` / `tabs.connect` channels and includes built-in binary data compression, greatly improving the transmission efficiency of large `Uint8Array` payloads.

## ✨ Features

- **Full type safety**: End-to-end type inference powered by tRPC, eliminating manual message parsing.
- **Three communication modes out of the box**:
  - Popup → Content Script
  - Content Script → Background
  - Popup → Background
- **Binary compression**: Automatically compresses `Uint8Array` using Snappy, with fine-grained control over compression scope to reduce message size and speed up transmission.
- **Zero-configuration server**: The server (receiving end) only needs a single line of code to start listening for connections.
- **Lightweight**: Core logic is concise and does not intrude into your existing architecture.
- **Native Promise support**: Calling a remote function feels just like a local async call.

## 📦 Installation

```bash
npm install @cyia/chrome-trpc @trpc/client @trpc/server
```

Or use yarn/pnpm.  
`@trpc/client` and `@trpc/server` are peer dependencies; please ensure compatible versions (^11.18.0).

## 🚀 Quick Start

### 1. Define a shared router (types)

Define your router in a shared `router.ts` file using `@trpc/server` so that both ends can reuse the types.

```typescript
import { initTRPC } from '@trpc/server';
import * as v from 'valibot';

const t = initTRPC.create();

export const appRouter = t.router({
  greet: t.procedure.input(v.string()).query(({ input }) => `Hello ${input}`),
  getData: t.procedure.query(() => ({ payload: new Uint8Array([1, 2, 3]) })),
});

export type AppRouter = typeof appRouter;
```

### 2. Server (receiving end)

In the script that provides the service (e.g., background or content script), use `createChromeHandler` to listen for connections from other parts.

```typescript
// background.ts or content-script.ts
import { createChromeHandler } from '@cyia/chrome-trpc/server';
import { appRouter } from './router';

// One-liner to start, automatically handles chrome.runtime.onConnect connections
createChromeHandler({ router: appRouter });
```

> 💡 Which script acts as the "server" depends on your communication direction.  
> For example: Popup → Background – Background is the server;  
> Popup → Content Script – Content Script is the server.

### 3. Client (calling end)

In the script that initiates calls (e.g., popup or content script), create a tRPC client and pass in a Chrome port.

```typescript
// popup.ts or content-script.ts
import { createTRPCProxyClient } from '@trpc/client';
import { chromeLink } from '@cyia/chrome-trpc/client';
import type { AppRouter } from './router';

// Establish connection to the target context (depends on communication mode)
const port = chrome.runtime.connect();

const trpc = createTRPCProxyClient<AppRouter>({
  links: [chromeLink({ port })],
});

// Now you can call remote procedures like local functions
const greeting = await trpc.greet.query('World');
console.log(greeting); // "Hello World"
```

## 🔌 Three Communication Modes Explained

| Direction                      | Client (caller) | Server (receiver) | How to obtain the `port`                                                    |
| ------------------------------ | --------------- | ----------------- | --------------------------------------------------------------------------- |
| **Popup → Background**          | Popup           | Background        | `chrome.runtime.connect()`                                                  |
| **Content Script → Background** | Content Script  | Background        | `chrome.runtime.connect()`                                                  |
| **Popup → Content Script**      | Popup           | Content Script    | First get the tabId via `chrome.tabs.query`,<br>then `chrome.tabs.connect(tabId)` |

### Example: Popup calling Content Script

**content-script.ts (server)**

```typescript
import { createChromeHandler } from '@cyia/chrome-trpc/server';
import { appRouter } from './router';
createChromeHandler({ router: appRouter });
```

**popup.ts (client)**

```typescript
import { chromeLink } from '@cyia/chrome-trpc/client';
import { createTRPCProxyClient } from '@trpc/client';
import type { AppRouter } from './router';

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
if (tab.id) {
  const port = chrome.tabs.connect(tab.id);
  const trpc = createTRPCProxyClient<AppRouter>({
    links: [chromeLink({ port })],
  });
  const data = await trpc.getData.query();
}
```

## 📦 Binary Compression

The adapter uses the [Snappy](https://github.com/zhipeng-jia/snappyjs) algorithm to compress and decompress `Uint8Array` data, significantly reducing the transfer size.

### Response Compression (server configuration)

In some scenarios you may want to explicitly specify which response paths should be compressed, or a procedure may return data that is not a plain `Uint8Array` but is still large.  
In such cases you can pass the `compressPathObj` option to `createChromeHandler`. The keys are the procedure route paths, and a value of `true` enables compression.

For example, suppose you extended your router with a `res` sub-router and a `cmp` query:

```typescript
// router.ts extended
export const appRouter = t.router({
  greet: t.procedure.input(v.string()).query(({ input }) => `Hello ${input}`),
  getData: t.procedure.query(() => ({ payload: new Uint8Array([1, 2, 3]) })),
  res: t.router({
    cmp: t.procedure.query(() => {
      return new Uint8Array([1, 2, 3, 4]);
    }),
  }),
});
```

Server configuration compressing the path `'res.cmp'`:

```typescript
createChromeHandler({
  router: appRouter,
  // Explicitly declare the procedure paths whose responses should be compressed (relative to appRouter)
  compressPathObj: { 'res.cmp': true },
});
```

> Paths use `.` to separate router levels, e.g., `'res.cmp'` corresponds to `appRouter.res.cmp`.  
> When `compressPathObj` is specified, only the listed paths will have their responses forcibly compressed.

### Request Compression (client configuration)

If the client needs to send large parameters (e.g., big arrays, complex objects), you can enable request compression via `context` at call time, without any server-side changes.

```typescript
// Assume the router has a clientCmp procedure that accepts complex parameters
// On the client side, pass { context: { compress: true } }
const result = await trpc.clientCmp.query(
  { arr1: [1, 2, 3], num1: 1, str1: '1', b1: true },
  { context: { compress: true } },
);
```

This way, `Uint8Array` or serializable data in the request body will be automatically compressed before transmission. The server decompresses it transparently, making the process invisible to your business logic.

By combining response compression and request compression, you can efficiently exchange large amounts of data between different parts of your Chrome extension.

## 💡 Notes

- **Type sharing**: Make sure the `AppRouter` type is shared between client and server (usually extracted as a common file).
- **Content script environment**: If the content script acts as the server, ensure it is properly injected via `content_scripts` in `manifest.json` and runs at the appropriate time.
- **Manifest permissions**: Ensure the required permissions are declared in `manifest.json` (e.g., `"tabs"` for Popup → Content Script connections).
- **Compression paths**: The paths in `compressPathObj` must exactly match the router structure, otherwise the configuration will not take effect.
- **Request compression**: When enabling `compress: true` on the client, ensure the input parameters contain compressible data (like `Uint8Array`), otherwise the compression effect may be negligible.

## 🔗 Related Links

- [GitHub Repository](https://github.com/wszgrcy/chrome-trpc)
- [Issue Tracker](https://github.com/wszgrcy/chrome-trpc/issues)
- [tRPC Official Documentation](https://trpc.io)
