import { test, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { ref, watchEffect, useRef, useWatchEffect, onEffectCleanup } from '../src'

test('<watchEffect> watchHandle / onCleanup / onEffectCleanup', () => {
  const logs: any[] = []
  const count = ref(0)
  const watchHandle = watchEffect((onCleanup) => {
    logs.push(count.value)
    onCleanup(() => logs.push('onCleanup'))
    onEffectCleanup(() => logs.push('onEffectCleanup'))
  })

  expect(logs.length).toBe(1)
  expect(logs[0]).toBe(0)

  count.value++
  expect(count.value).toBe(1)
  expect(logs.at(-1)).toBe(1)
  expect(logs.at(-2)).toBe('onCleanup')
  expect(logs.at(-3)).toBe('onEffectCleanup')

  count.value++
  expect(count.value).toBe(2)
  expect(logs.at(-1)).toBe(2)
  expect(logs.at(-2)).toBe('onCleanup')

  watchHandle.pause()
  count.value++
  expect(logs.length).toBe(7)

  watchHandle.resume()
  count.value++
  expect(logs.at(-1)).toBe(4)

  watchHandle()
  expect(logs.at(-1)).toBe('onCleanup')
  expect(logs.at(-2)).toBe('onEffectCleanup')
  expect(logs.at(-3)).toBe(4)

  count.value++
  expect(count.value).toBe(5)
  expect(logs.length).toBe(15)
  expect(logs.at(-1)).toBe('onCleanup')
  expect(logs.at(-2)).toBe('onEffectCleanup')
})

test('<useWatchEffect>', () => {
  let weTriggerCount = 0
  const logs: any[] = []
  const count = ref(0)
  const hookRender = renderHook(() => {
    return useWatchEffect((onCleanup) => {
      weTriggerCount++
      logs.push(count.value)
      onCleanup(() => logs.push('onCleanup'))
    })
  })

  expect(weTriggerCount).toBe(1)
  expect(logs.length).toBe(1)
  expect(logs[0]).toBe(0)

  act(() => count.value++)
  expect(weTriggerCount).toBe(2)
  expect(logs.at(-1)).toBe(1)

  hookRender.result.current.pause()
  act(() => count.value++)
  expect(weTriggerCount).toBe(2)

  hookRender.result.current.resume()
  expect(weTriggerCount).toBe(3)
  expect(logs.at(-1)).toBe(2)

  hookRender.unmount()
  expect(logs.at(-2)).toBe(2)
  expect(logs.at(-1)).toBe('onCleanup')
})

test('<useWatchEffect> inline effect runs once per mutation', () => {
  let runs = 0
  const hookRender = renderHook(() => {
    const count = useRef(0)
    useWatchEffect(() => {
      runs++
      void count.value
    })
    return count
  })

  expect(runs).toBe(1)
  act(() => hookRender.result.current.value++)
  expect(runs).toBe(2)
})

test('<useWatchEffect> retracks when a React prop changes its source', () => {
  const first = ref(0)
  const second = ref(0)
  const calls: string[] = []
  const hookRender = renderHook(
    ({ source, label }) =>
      useWatchEffect(() => {
        calls.push(`${label}:${source.value}`)
      }),
    { initialProps: { source: first, label: 'first' } },
  )

  hookRender.rerender({ source: second, label: 'second' })
  expect(calls).toEqual(['first:0', 'second:0'])

  act(() => second.value++)
  expect(calls.at(-1)).toBe('second:1')

  const callCount = calls.length
  act(() => first.value++)
  expect(calls).toHaveLength(callCount)

  hookRender.unmount()
  act(() => second.value++)
  expect(calls).toHaveLength(callCount)
})

test('<useWatchEffect> retracks after an old source runs during layout', () => {
  const first = ref(0)
  const second = ref(0)
  const calls: string[] = []
  const hookRender = renderHook(
    ({ source, label, mutateOld }) => {
      useLayoutEffect(() => {
        if (mutateOld) first.value++
      }, [mutateOld])
      return useWatchEffect(() => {
        calls.push(`${label}:${source.value}`)
      })
    },
    { initialProps: { source: first, label: 'first', mutateOld: false } },
  )

  hookRender.rerender({ source: second, label: 'second', mutateOld: true })
  expect(calls).toEqual(['first:0', 'first:1', 'second:0'])

  act(() => second.value++)
  expect(calls.at(-1)).toBe('second:1')
})

test('<useWatchEffect> retracks a paused source when resumed', () => {
  const first = ref(0)
  const second = ref(0)
  const calls: string[] = []
  const hookRender = renderHook(
    ({ source, label }) => {
      const handle = useWatchEffect(() => {
        calls.push(`${label}:${source.value}`)
      })
      return handle
    },
    { initialProps: { source: first, label: 'first' } },
  )

  hookRender.result.current.pause()
  hookRender.rerender({ source: second, label: 'second' })
  act(() => second.value++)
  expect(calls).toEqual(['first:0'])

  hookRender.result.current.resume()
  expect(calls.at(-1)).toBe('second:1')

  const callCount = calls.length
  act(() => first.value++)
  expect(calls).toHaveLength(callCount)
})
