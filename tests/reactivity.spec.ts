import { test, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  customRef,
  ref,
  reactive,
  shallowRef,
  triggerRef,
  isRef,
  isReactive,
  onUpdated,
  useReactivity,
} from '../src'

test('<useReactivity> ', () => {
  let renderCount = 0
  const refCount = ref(0)
  const reactiveCount = reactive({ count: 10 })
  const { result } = renderHook(() => {
    onUpdated(() => renderCount++)
    return useReactivity(() => ({
      ref_: refCount,
      reactive_: reactiveCount,
    }))
  })

  expect(isRef(result.current.ref_)).toBeTruthy()
  expect(isReactive(result.current.reactive_)).toBeTruthy()
  expect(result.current.ref_).toBe(refCount)
  expect(result.current.reactive_).toBe(reactiveCount)
  expect(result.current.ref_.value).toBe(0)

  act(() => refCount.value++)
  expect(result.current.ref_.value).toBe(1)
  expect(renderCount).toBe(1)

  act(() => reactiveCount.count++)
  expect(result.current.reactive_.count).toBe(11)
  expect(renderCount).toBe(2)

  act(() => result.current.reactive_.count++)
  expect(reactiveCount.count).toBe(12)
  expect(renderCount).toBe(3)
})

test('<useReactivity> evaluates one getter result for each render', () => {
  const source = ref(0)
  let getterCalls = 0
  let renderGetterCalls = 0
  let rendering = false
  let renders = 0

  const { result } = renderHook(() => {
    renders++
    rendering = true
    const value = useReactivity(() => {
      getterCalls++
      if (rendering) renderGetterCalls++
      return { source }
    })
    rendering = false
    return value
  })

  // One call belongs to render; two committed reads classify stable roots vs wrapper factories.
  expect(getterCalls).toBe(3)
  expect(renderGetterCalls).toBe(1)
  expect(renders).toBe(1)

  act(() => source.value++)
  expect(result.current.source.value).toBe(1)
  expect(renders).toBe(2)
  expect(getterCalls).toBe(7)
  expect(renderGetterCalls).toBe(2)
})

test('<useReactivity> ignores fresh plain wrapper identities', () => {
  const source = ref(0)
  let renders = 0

  const { result } = renderHook(() => {
    renders++
    return useReactivity(() => ({ source, nested: {} }))
  })

  expect(renders).toBe(1)
  act(() => source.value++)
  expect(result.current.source.value).toBe(1)
  expect(renders).toBe(2)
})

test('<useReactivity> preserves stable plain-object replacement identity', () => {
  const first = { value: 0 }
  const selected = shallowRef(first)
  let renders = 0
  const { result } = renderHook(() => {
    renders++
    return useReactivity(() => selected.value)
  })

  const second = { value: 0 }
  act(() => {
    selected.value = second
  })

  expect(result.current).toBe(second)
  expect(result.current).not.toBe(first)
  expect(renders).toBe(2)
})

test('<useReactivity> ignores fresh plain wrappers returned by reactive accessors', () => {
  const source = ref(0)
  const store = reactive({
    get wrapper() {
      return { source, nested: {} }
    },
  })
  let renders = 0

  const { result } = renderHook(() => {
    renders++
    return useReactivity(() => store)
  })

  expect(renders).toBe(1)
  act(() => source.value++)
  expect(result.current.wrapper.source).toBe(1)
  expect(renders).toBe(2)
})

test('<useReactivity> preserves explicit module ref triggers inside a wrapper', () => {
  const shallow = shallowRef({ count: 0 })
  let customTrigger!: () => void
  const custom = customRef<number>((track, trigger) => {
    customTrigger = trigger
    return {
      get() {
        track()
        return 1
      },
      set() {
        trigger()
      },
    }
  })
  let shallowRenders = 0
  let customRenders = 0

  renderHook(() => {
    shallowRenders++
    return useReactivity(() => ({ shallow }))
  })
  renderHook(() => {
    customRenders++
    return useReactivity(() => ({ custom }))
  })

  act(() => triggerRef(shallow))
  act(() => customTrigger())
  expect(shallowRenders).toBe(2)
  expect(customRenders).toBe(2)
})

test('<useReactivity> captures opaque derived values', () => {
  const source = ref(0)
  let renders = 0
  const { result } = renderHook(() => {
    renders++
    return useReactivity(() => new Date(source.value))
  })

  act(() => source.value++)
  expect(result.current.getTime()).toBe(1)
  expect(renders).toBe(2)
})
