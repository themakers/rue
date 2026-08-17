import { expect, expectTypeOf, test } from 'vitest'
import type { ComputedRef, EffectScope, Ref, WatchHandle, WritableComputedRef } from '@vue/reactivity'
import type { TemplateRef } from '../src'
import { useComputed, useEffectScope, useReactive, useRef, useTemplateRef, useWatch } from '../src'

function assertPublicTypes() {
  const count = useRef(1)
  const state = useReactive({ count: 1, nested: { ready: true } })
  const doubled = useComputed(() => count.value * 2)
  const writable = useComputed({
    get: () => count.value,
    set: (value: number) => {
      count.value = value
    },
  })
  const handle = useWatch(count, (value, oldValue) => {
    expectTypeOf(value).toEqualTypeOf<number>()
    expectTypeOf(oldValue).toEqualTypeOf<number>()
  })
  const scope = useEffectScope()
  const element = useTemplateRef<HTMLDivElement>()

  expectTypeOf(count).toEqualTypeOf<Ref<number, number>>()
  expectTypeOf(state.nested.ready).toEqualTypeOf<boolean>()
  expectTypeOf(doubled).toEqualTypeOf<ComputedRef<number>>()
  expectTypeOf(writable).toEqualTypeOf<WritableComputedRef<number, number>>()
  expectTypeOf(handle).toEqualTypeOf<WatchHandle>()
  expectTypeOf(scope).toEqualTypeOf<EffectScope>()
  expectTypeOf(element).toEqualTypeOf<TemplateRef<HTMLDivElement>>()
  expectTypeOf(element.value).toEqualTypeOf<HTMLDivElement | null>()
  expectTypeOf(element.current).toEqualTypeOf<HTMLDivElement | null>()
}

test('public hook overloads retain Vue types', () => {
  expectTypeOf(assertPublicTypes).toEqualTypeOf<() => void>()
  expect(true).toBe(true)
})
