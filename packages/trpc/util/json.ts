import { SuperJSON, SuperJSONResult } from 'superjson';
import { compress, uncompress } from 'snappyjs';
import { getParser } from 'bowser';

class DefaultSuperJSON {
  superJson;
  constructor() {
    this.superJson = new SuperJSON();
  }
}

class CompressSuperJSON {
  superJson;
  constructor() {
    this.superJson = new SuperJSON();
  }
}

const defaultSuperJSON = new DefaultSuperJSON();
const compressSuperJSON = new CompressSuperJSON();
enum CustomType {
  unit8array = '0',
}
function uint8ArrayToBase64(bytes: Uint8Array) {
  return btoa(new TextDecoder('iso-8859-1').decode(bytes));
}

function base64ToUint8Array(base64: string) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function jsonToUint8Array(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj));
}

function uint8ArrayToJson<T = unknown>(data: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(data)) as T;
}

export function initJsonConvert() {
  const useStructuredClone =
    chrome.runtime.getManifest()['message_serialization'] ===
      'structured_clone' &&
    getParser(navigator.userAgent, (navigator as any).userAgentData).satisfies({
      chrome: '>=148.0.0.0',
    });
  const isApplicable = (v: unknown): v is Uint8Array => v instanceof Uint8Array;

  const defaultConfig = {
    serialize: useStructuredClone
      ? (v: Uint8Array) => v
      : (v: Uint8Array) => uint8ArrayToBase64(v),
    deserialize: useStructuredClone
      ? (v: any) => v
      : (v: any) => base64ToUint8Array(v),
    isApplicable,
  };
  const compressConfig = {
    serialize: useStructuredClone
      ? (v: Uint8Array) => compress(v)
      : (v: Uint8Array) => uint8ArrayToBase64(compress(v)),
    deserialize: useStructuredClone
      ? (v: any) => uncompress(v)
      : (v: any) => uncompress(base64ToUint8Array(v)),
    isApplicable,
  };

  defaultSuperJSON.superJson.registerCustom<Uint8Array, any>(
    defaultConfig,
    CustomType.unit8array,
  );
  compressSuperJSON.superJson.registerCustom<Uint8Array, any>(
    compressConfig,
    CustomType.unit8array,
  );
}
export function serialize(
  object: Parameters<typeof defaultSuperJSON.superJson.serialize>[0],
  compress?: boolean,
) {
  if (!compress) {
    return defaultSuperJSON.superJson.serialize(object);
  }
  const result = compressSuperJSON.superJson.serialize(object);
  (result as any).__compress = true;
  if (result.meta?.values) {
    if (Array.isArray(result.meta?.values)) {
      if (result.meta.values[0][1] === CustomType.unit8array) {
        return result;
      }
    } else {
      const list = Object.values(result.meta.values);
      if (list.some((item) => Array.isArray(item[0]))) {
        return result;
      } else {
        return uint8ArrayToBase64(jsonToUint8Array(result));
      }
    }
  }
  return result;
}
export function deserialize<T = unknown>(
  payload: SuperJSONResult & { __compress?: boolean },
): T {
  if (typeof payload === 'string') {
    payload = uint8ArrayToJson(base64ToUint8Array(payload));
  }

  return payload.__compress
    ? compressSuperJSON.superJson.deserialize(payload, { inPlace: true })
    : defaultSuperJSON.superJson.deserialize(payload, { inPlace: true });
}
