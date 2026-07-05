import { createChromeHandler } from '@cyia/chrome-trpc/server';
import { appRouter } from './router';

createChromeHandler({
  router: appRouter,
  compressPathObj: { 'res.cmp': true },
  createContext: () => ({
    ctxValue: '123',
  }),
});
