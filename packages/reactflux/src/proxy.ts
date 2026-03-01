const proxyMap = new WeakMap<object, object>();
const rawMap = new WeakMap<object, object>();

let isBatching = false;

function isPlainObjectOrArray(value: unknown): value is object {
    if (value === null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || Array.isArray(value);
}

export function createStateProxy<T extends object>(state: T, onChange: () => void): T {
    if (!isPlainObjectOrArray(state)) {
        return state;
    }

    if (proxyMap.has(state)) {
        return proxyMap.get(state) as T;
    }

    if (rawMap.has(state)) {
        return state; // It's already a proxy
    }

    const handler: ProxyHandler<T> = {
        get(target, prop, receiver) {
            if (Array.isArray(target) && typeof prop === 'string' && ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].includes(prop)) {
                return (...args: unknown[]) => {
                    const prevBatching = isBatching;
                    isBatching = true;

                    const method = Reflect.get(target, prop, receiver) as (...a: unknown[]) => unknown;
                    const result = Reflect.apply(method, receiver, args);

                    isBatching = prevBatching;
                    if (!isBatching) {
                        onChange();
                    }
                    return result;
                };
            }

            const value = Reflect.get(target, prop, receiver);
            if (isPlainObjectOrArray(value) && proxyMap.has(value)) {
                return proxyMap.get(value);
            }
            return value;
        },
        set(target, prop, value, receiver) {
            // Unpack if value is a proxy itself
            const rawValue = rawMap.has(value as object) ? rawMap.get(value as object) : value;

            // Immediately wrap new nested objects
            if (isPlainObjectOrArray(rawValue)) {
                createStateProxy(rawValue as object, onChange);
            }

            const result = Reflect.set(target, prop, rawValue, receiver);

            // Trigger listeners on write
            if (!isBatching) onChange();

            return result;
        },
        deleteProperty(target, prop) {
            const result = Reflect.deleteProperty(target, prop);
            if (!isBatching) onChange();
            return result;
        }
    };

    const proxy = new Proxy(state, handler);
    proxyMap.set(state, proxy);
    rawMap.set(proxy, state);

    // Recursively proxy existing nested objects upfront
    for (const key in state) {
        if (Object.prototype.hasOwnProperty.call(state, key)) {
            const val = state[(key as keyof typeof state)];
            if (isPlainObjectOrArray(val)) {
                createStateProxy(val as object, onChange);
            }
        }
    }

    return proxy;
}
