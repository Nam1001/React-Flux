import { test, expect, vi } from 'vitest'

test('spy test', () => {
  const spy = vi.spyOn(Storage.prototype, 'setItem')
  window.localStorage.setItem('foo', 'bar')
  expect(spy).toHaveBeenCalled()
})
