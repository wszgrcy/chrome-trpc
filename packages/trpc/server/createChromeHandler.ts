import type { AnyRouter, inferRouterContext } from '@trpc/server';
import { handleChromeMessage } from './handleChromeMessage';
import { deserialize, initJsonConvert } from '../util/json';
import { Message } from '../type';

type Awaitable<T> = T | Promise<T>;
type ChromHandleOptions<TRouter extends AnyRouter> = {
  createContext?: () => Awaitable<inferRouterContext<TRouter>>;
  router: TRouter;
  compressPathObj?: Record<string, boolean>;
};

class ChromeHandler<TRouter extends AnyRouter> {
  #getWebviewSubscription() {
    return new Map();
  }
  constructor(private options: ChromHandleOptions<TRouter>) {
    this.init();
  }

  init() {
    initJsonConvert();
    chrome.runtime.onConnect.addListener((port) => {
      const fn: (message: Message, port: chrome.runtime.Port) => void = (
        message,
      ) => {
        handleChromeMessage({
          router: this.options.router,
          createContext: this.options.createContext,
          message: {
            ...message,
            operation: {
              ...message.operation,
              input: deserialize(message.operation.input as any),
            },
          },
          subscriptions: this.#getWebviewSubscription(),
          port,
          compressPathObj: this.options.compressPathObj,
        });
      };
      port.onMessage.addListener(fn);
      port.onDisconnect.addListener(() => {
        port.onMessage.removeListener(fn);
      });
    });
  }
}

export const createChromeHandler = <TRouter extends AnyRouter>(
  options: ChromHandleOptions<TRouter>,
) => new ChromeHandler(options);
