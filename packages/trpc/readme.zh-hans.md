# @cyia/chrome-trpc

[English](./readme.md) | [中文](./readme.zh-hans.md)

[![npm version](https://badge.fury.io/js/%40cyia%2Fchrome-trpc.svg)](https://badge.fury.io/js/%40cyia%2Fchrome-trpc)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

为 Chrome 扩展（插件）量身定制的 **tRPC 适配器**，让您能在扩展的不同运行时（popup、content script、background）之间安全、便捷地进行类型安全的远程过程调用。  
它深度整合了 Chrome 内部的 `runtime.connect` / `tabs.connect` 通道，并内置二进制数据压缩，大幅提升大型 `Uint8Array` 的传输效率。

## ✨ 特性

- **全类型安全**：基于 tRPC 实现端到端类型推导，杜绝手动解析消息。
- **三种通讯方式开箱即用**：
  - Popup → Content Script
  - Content Script → Background
  - Popup → Background
- **二进制压缩**：自动使用 Snappy 压缩 `Uint8Array`，并可精细控制压缩范围，减少消息体积，加快传输。
- **零配置服务端**：服务端（接收端）只需一行代码即可监听连接。
- **轻量级**：核心逻辑简洁，不侵入现有架构。
- **原生 Promise 支持**：调用远程函数如同本地异步调用。

## 📦 安装

```bash
npm install @cyia/chrome-trpc @trpc/client @trpc/server
```

或使用 yarn/pnpm。  
`@trpc/client` 与 `@trpc/server` 为 peer dependencies，请确保版本兼容（^11.18.0）。

## 🚀 快速开始

### 1. 定义共享路由（类型）

在一个公共的 `router.ts` 文件中使用 `@trpc/server` 定义路由，以便两端复用类型。

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

- 如果在Content Script中使用，需要设置isServer `const t = initTRPC.create({ isServer: true });`

### 2. 服务端（接收端）

在需要提供服务的脚本（如 background 或 content script）中，使用 `createChromeHandler` 监听来自其他部分的连接。

```typescript
// background.ts 或 content-script.ts
import { createChromeHandler } from '@cyia/chrome-trpc/server';
import { appRouter } from './router';

// 一行启动，自动处理 chrome.runtime.onConnect 连接
createChromeHandler({ router: appRouter });
```

> 💡 哪个脚本作为“服务端”，取决于您的通讯方向。  
> 例如：Popup → Background 时，Background 为服务端；  
> Popup → Content Script 时，Content Script 为服务端。

### 3. 客户端（调用端）

在需要发起调用的脚本（如 popup 或 content script）中，创建 tRPC 客户端并传入 Chrome 端口。

```typescript
// popup.ts 或 content-script.ts
import { createTRPCProxyClient } from '@trpc/client';
import { chromeLink } from '@cyia/chrome-trpc/client';
import type { AppRouter } from './router';

// 建立与目标运行时的连接（取决于通讯方式）
const port = chrome.runtime.connect();

const trpc = createTRPCProxyClient<AppRouter>({
  links: [chromeLink({ port })],
});

// 现在即可像调用本地函数一样调用远程过程
const greeting = await trpc.greet.query('世界');
console.log(greeting); // "Hello 世界"
```

## 🔌 三种通讯方式详解

| 方向                            | 客户端（调用方） | 服务端（接收方） | 如何获取 `port`                                                              |
| ------------------------------- | ---------------- | ---------------- | ---------------------------------------------------------------------------- |
| **Popup → Background**          | Popup            | Background       | `chrome.runtime.connect()`                                                   |
| **Content Script → Background** | Content Script   | Background       | `chrome.runtime.connect()`                                                   |
| **Popup → Content Script**      | Popup            | Content Script   | 先通过 `chrome.tabs.query` 获取 tabId，<br>然后 `chrome.tabs.connect(tabId)` |

### 示例：Popup 调用 Content Script

**content-script.ts (服务端)**

```typescript
import { createChromeHandler } from '@cyia/chrome-trpc/server';
import { appRouter } from './router';
createChromeHandler({ router: appRouter });
```

**popup.ts (客户端)**

```typescript
import { chromeLink } from '@cyia/chrome-trpc/client';
import { createTRPCProxyClient } from '@trpc/client';
import type { AppRouter } from './router';
// popup 到 Content Script 时
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const port = chrome.tabs.connect(tab.id);
// popup/Content Script 到 Background 时
const port = chrome.runtime.connect();

const trpc = createTRPCProxyClient<AppRouter>({
  links: [chromeLink({ port })],
});
const data = await trpc.getData.query();
```

## 📦 二进制压缩

适配器使用 [Snappy](https://github.com/zhipeng-jia/snappyjs) 算法对 `Uint8Array` 数据进行压缩与解压，大幅降低传输体积。

### 响应内容压缩（服务端配置）

某些场景下，您可能希望显式指定需要压缩的响应路径，或者过程返回的数据并非纯 `Uint8Array` 但体积较大。  
此时可在 `createChromeHandler` 中传入 `compressPathObj` 参数，键为过程的路由路径，值为 `true` 表示启用压缩。

例如，假设您的路由中定义了 `res` 子路由和 `cmp` 查询：

```typescript
// router.ts 扩展
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

服务端配置压缩路径 `'res.cmp'`：

```typescript
createChromeHandler({
  router: appRouter,
  // 显式声明需要压缩响应的过程路径（相对 appRouter）
  compressPathObj: { 'res.cmp': true },
});
```

> 路径使用 `.` 分隔路由层级，如 `'res.cmp'` 对应 `appRouter.res.cmp`。  
> 指定了 `compressPathObj` ，只有列表中标记的会强制压缩响应体

### 请求参数压缩（客户端配置）

如果客户端需要发送大型参数（如大数组、复杂对象），可以在调用时通过 `context` 启用请求压缩，无需修改服务端配置。

```typescript
// 假设路由中存在 clientCmp 过程，接受复杂参数
// 客户端调用时，传入 { context: { compress: true } }
const result = await trpc.clientCmp.query(
  { arr1: [1, 2, 3], num1: 1, str1: '1', b1: true },
  { context: { compress: true } },
);
```

这样，请求体中的 `Uint8Array` 或可序列化数据会被自动压缩后再传输，服务端收到后自动解压，整个过程对业务逻辑透明。

结合响应压缩与请求压缩，您可以高效地在 Chrome 扩展的不同部分之间交换大量数据。

## 💡 注意事项

- **类型共享**：务必确保 `AppRouter` 类型在客户端与服务端之间共享（通常抽取为公共文件）。
- **Content Script 环境**：若 Content Script 作为服务端，请确保它在 `manifest.json` 的 `content_scripts` 中正确注入，且运行在适当的时机。
- **Manifest 权限**：确保 `manifest.json` 中已声明所需的权限（如 `"tabs"` 用于 Popup → Content Script 连接）。
- **压缩路径**：`compressPathObj` 中的路径必须与路由结构精确匹配，否则配置不会生效。
- **请求压缩**：客户端启用 `compress: true` 时，请确保输入参数中包含可压缩的数据（如 `Uint8Array`），否则压缩效果不明显。

## 🔗 相关链接

- [GitHub 仓库](https://github.com/wszgrcy/chrome-trpc)
- [问题反馈](https://github.com/wszgrcy/chrome-trpc/issues)
- [tRPC 官方文档](https://trpc.io)
