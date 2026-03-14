import type { Store } from './types.js'

export function compose<D extends object, S extends Store<D>>(store: S): S

export function compose<D extends object, S extends Store<D>, R1>(
  store: S,
  f1: (store: S) => R1
): R1

export function compose<D extends object, S extends Store<D>, R1, R2>(
  store: S,
  f1: (store: S) => R1,
  f2: (store: R1) => R2
): R2

export function compose<D extends object, S extends Store<D>, R1, R2, R3>(
  store: S,
  f1: (store: S) => R1,
  f2: (store: R1) => R2,
  f3: (store: R2) => R3
): R3

export function compose<D extends object>(
  store: Store<D>,
  ...enhancers: Array<(store: unknown) => unknown>
): unknown

/**
 * Pipes a Storve store through one or more enhancer functions left to right.
 * Each enhancer receives the output of the previous one.
 *
 * @template D - The generic parameter for the base store definition object.
 * @param {Store<D>} store - The base store to enhance.
 * @param {...Array<Function>} enhancers - The enhancer functions applied left to right.
 * @returns {unknown} The enhanced store instance.
 */
export function compose<D extends object>(
  store: Store<D>,
  ...enhancers: Array<(store: unknown) => unknown>
): unknown {
  if (enhancers.length === 0) {
    return store
  }

  let currentStore: unknown = store
  for (let i = 0; i < enhancers.length; i++) {
    currentStore = enhancers[i](currentStore)
  }
  return currentStore
}
