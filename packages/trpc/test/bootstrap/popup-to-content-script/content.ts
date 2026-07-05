import { createChromeHandler } from '@cyia/chrome-trpc/server';
import { appRouter } from '../router';

createChromeHandler({
  router: appRouter,
  compressPathObj: { 'res.cmp': true },
  createContext: () => ({
    ctxValue: '123',
  }),
});

chrome.runtime.sendMessage({ type: 'start' });
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'result') {
    return;
  }
  document.body.textContent = '';
  const el = document.createElement('p');
  el.id = 'result';
  el.textContent = JSON.stringify(message.data);
  el.style.visibility = 'visible';
  document.body.appendChild(el);
});
