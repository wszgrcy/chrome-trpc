import { Operation, TRPCClientError, TRPCLink } from '@trpc/client';
import type {
  AnyRouter,
  AnyTRPCRouter,
  inferRouterContext,
  inferTRPCClientTypes,
  ProcedureType,
} from '@trpc/server';
import type { TRPCResponseMessage } from '@trpc/server/rpc';
import { observable, Observer } from '@trpc/server/observable';
import {
  getTransformer,
  TransformerOptions,
} from '@trpc/client/unstable-internals';
import { transformResult } from '@trpc/server/unstable-core-do-not-import';
import { deserialize, initJsonConvert, serialize } from '../util/json';

type ChromeCallbackResult<TRouter extends AnyRouter = AnyRouter> =
  TRPCResponseMessage<unknown, inferRouterContext<TRouter>>;

type ChromeCallbacks<TRouter extends AnyRouter = AnyRouter> = Observer<
  ChromeCallbackResult<TRouter>,
  TRPCClientError<TRouter>
>;

type ChromeRequest = {
  type: ProcedureType;
  callbacks: ChromeCallbacks;
  op: Operation;
};

class ChromeClient {
  #pendingRequests = new Map<string | number, ChromeRequest>();
  port;
  constructor(port: chrome.runtime.Port) {
    this.port = port;
    port.onMessage.addListener((message) => {
      if (message.result?.data) {
        message.result.data = deserialize(message.result.data);
      }
      this.#handleResponse(message);
    });
  }

  #handleResponse(response: TRPCResponseMessage) {
    const request = response.id && this.#pendingRequests.get(response.id);
    if (!request) {
      return;
    }

    request.callbacks.next(response);

    if ('result' in response && response.result.type === 'stopped') {
      request.callbacks.complete();
    }
  }
  index = 0;
  request(op: Operation, callbacks: ChromeCallbacks) {
    const { type } = op;
    const id = `${this.index++}`;

    this.#pendingRequests.set(id, {
      type,
      callbacks,
      op,
    });
    const message = {
      method: 'request',
      operation: {
        ...op,
        input: serialize(op.input, !!op.context['compress']),
      },
      id: id,
    };

    this.port.postMessage(message);
    return () => {
      const callbacks = this.#pendingRequests.get(id)?.callbacks;

      this.#pendingRequests.delete(id);

      callbacks?.complete();

      if (type === 'subscription') {
        this.port.postMessage({
          id,
          operation: {},
          method: 'subscription.stop',
        });
      }
    };
  }
}

export type ChromeLinkOptions<TRouter extends AnyTRPCRouter> =
  TransformerOptions<inferTRPCClientTypes<TRouter>>;
export function chromeLink<TRouter extends AnyRouter>(
  opts: ChromeLinkOptions<TRouter> & {
    port: chrome.runtime.Port;
  },
): TRPCLink<TRouter> {
  initJsonConvert();
  const port = opts.port;
  return () => {
    const client = new ChromeClient(port);
    const transformer = getTransformer(opts?.transformer);

    return ({ op }) =>
      observable((observer) => {
        op.input = transformer.input.serialize(op.input);

        const unsubscribe = client.request(op, {
          error(err) {
            observer.error(err as TRPCClientError<any>);
            unsubscribe();
          },
          complete() {
            observer.complete();
          },
          next(response) {
            const transformed = transformResult(response, transformer.output);

            if (!transformed.ok) {
              observer.error(TRPCClientError.from(transformed.error));
              return;
            }

            observer.next({ result: transformed.result });

            if (op.type !== 'subscription') {
              unsubscribe();
              observer.complete();
            }
          },
        });

        return () => {
          unsubscribe();
        };
      });
  };
}
