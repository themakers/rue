import { startTransition, Suspense, useLayoutEffect, useState } from 'react'
import { act, render, renderHook, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, expect, test, vi } from 'vitest'
import { reactive, ref, useReactive, useReactivity, useWatch, useWatchEffect } from '../src'
import { getActiveSubscriptionCount } from '../src/_subscription'

afterEach(() => {
  vi.useRealTimers()
})

test('updates from timers rerender subscribed components', () => {
  vi.useFakeTimers()

  let renders = 0
  const { result } = renderHook(() => {
    renders++
    return useReactive({ count: 0 })
  })
  setTimeout(() => result.current.count++, 10)

  act(() => vi.runAllTimers())
  expect(result.current.count).toBe(1)
  expect(renders).toBe(2)
})

test('a mutation between render and subscribe is reconciled before settling', () => {
  const store = reactive({ count: 0 })

  function Mutator() {
    useLayoutEffect(() => {
      store.count = 1
    }, [])
    return null
  }

  function Consumer() {
    const state = useReactivity(() => store)
    return <span data-testid="gap-value">{state.count}</span>
  }

  render(
    <>
      <Mutator />
      <Consumer />
    </>,
  )

  expect(screen.getByTestId('gap-value').textContent).toBe('1')
})

test('a failed initial subscription leaves no active effect', () => {
  const baseline = getActiveSubscriptionCount()
  let shouldThrow = false
  const store = reactive({
    get value() {
      if (shouldThrow) throw new Error('subscribe failed')
      return 0
    },
  })
  const originalConsoleError = console.error
  console.error = () => undefined

  function Mutator() {
    useLayoutEffect(() => {
      shouldThrow = true
    }, [])
    return null
  }

  function Consumer() {
    const state = useReactivity(() => store)
    return <span>{state.value}</span>
  }

  try {
    expect(() =>
      render(
        <>
          <Mutator />
          <Consumer />
        </>,
      ),
    ).toThrow('subscribe failed')
    expect(getActiveSubscriptionCount()).toBe(baseline)
  } finally {
    console.error = originalConsoleError
  }
})

test('a root source replacement is reconciled even when values are equal', () => {
  const first = reactive({ value: 0 })
  const second = reactive({ value: 0 })
  let current = first

  function Mutator() {
    useLayoutEffect(() => {
      current = second
    }, [])
    return null
  }

  function Consumer() {
    const state = useReactivity(() => current)
    return <span data-testid="identity-value">{state === second ? 'second' : 'first'}</span>
  }

  render(
    <>
      <Mutator />
      <Consumer />
    </>,
  )

  expect(screen.getByTestId('identity-value').textContent).toBe('second')
})

test('an accessor reactive replacement is reconciled even when values are equal', () => {
  const first = reactive({ value: 0 })
  const second = reactive({ value: 0 })
  let current = first
  const store = reactive({
    get selected() {
      return current
    },
  })

  function Mutator() {
    useLayoutEffect(() => {
      current = second
    }, [])
    return null
  }

  function Consumer() {
    const state = useReactivity(() => store)
    return <span data-testid="accessor-identity">{state.selected === second ? 'second' : 'first'}</span>
  }

  render(
    <>
      <Mutator />
      <Consumer />
    </>,
  )

  expect(screen.getByTestId('accessor-identity').textContent).toBe('second')
})

test('an accessor dependency changed during layout is reconciled', () => {
  const backing = ref(0)
  const store = reactive({
    get value() {
      return backing.value
    },
  })

  function Mutator() {
    useLayoutEffect(() => {
      backing.value = 1
    }, [])
    return null
  }

  function Consumer() {
    const state = useReactivity(() => store)
    return <span data-testid="accessor-value">{state.value}</span>
  }

  render(
    <>
      <Mutator />
      <Consumer />
    </>,
  )

  expect(screen.getByTestId('accessor-value').textContent).toBe('1')
})

test('useWatch switches source and invokes the latest callback', () => {
  const first = ref(0)
  const second = ref(0)
  const calls: string[] = []
  const { rerender } = renderHook(
    ({ source, label }) => useWatch(source, (value) => calls.push(`${label}:${value}`)),
    { initialProps: { source: first, label: 'first' } },
  )

  rerender({ source: second, label: 'second' })
  act(() => first.value++)
  act(() => second.value++)

  expect(calls).toEqual(['second:1'])
})

test('useReactivity replaces its watched source after rerender', () => {
  const first = ref(0)
  const second = ref(0)
  let renders = 0
  const { result, rerender } = renderHook(
    ({ source }) => {
      renders++
      return useReactivity(() => source).value
    },
    { initialProps: { source: first } },
  )

  rerender({ source: second })
  const afterSwitch = renders

  act(() => second.value++)
  expect(result.current).toBe(1)
  expect(renders).toBeGreaterThan(afterSwitch)

  const afterCurrentMutation = renders
  act(() => first.value++)
  expect(renders).toBe(afterCurrentMutation)
})

test('an abandoned source switch cannot replace the committed subscription', async () => {
  const first = reactive({ count: 0 })
  const second = reactive({ count: 0 })
  let switchSource!: () => void
  let release!: () => void
  let blocked = true
  const gate = new Promise<void>((resolve) => {
    release = () => {
      blocked = false
      resolve()
    }
  })

  function Consumer() {
    const [source, setSource] = useState(first)
    switchSource = () => setSource(second)
    const state = useReactivity(() => source)
    if (source === second && blocked) throw gate
    return (
      <span data-testid="source-count">
        {source === first ? `first:${state.count}` : `second:${state.count}`}
      </span>
    )
  }

  render(
    <Suspense fallback={<span>waiting</span>}>
      <Consumer />
    </Suspense>,
  )

  act(() => startTransition(switchSource))
  expect(screen.getByTestId('source-count').textContent).toBe('first:0')

  act(() => first.count++)
  expect(screen.getByTestId('source-count').textContent).toBe('first:1')

  await act(async () => release())
  expect(screen.getByTestId('source-count').textContent).toBe('second:0')

  act(() => first.count++)
  expect(screen.getByTestId('source-count').textContent).toBe('second:0')
  act(() => second.count++)
  expect(screen.getByTestId('source-count').textContent).toBe('second:1')
})

test('snapshot reconciliation traverses arrays, collections, and cycles', () => {
  const raw: {
    list: number[]
    map: Map<string, number>
    set: Set<number>
    self?: unknown
  } = {
    list: [1],
    map: new Map([['one', 1]]),
    set: new Set([1]),
  }
  raw.self = raw
  const store = reactive(raw)
  let renders = 0
  renderHook(() => {
    renders++
    return useReactivity(() => store)
  })

  const initial = renders
  act(() => store.list.push(2))
  act(() => store.map.set('two', 2))
  act(() => store.set.add(2))

  expect(renders).toBe(initial + 3)
})

test('server rendering uses getServerSnapshot without creating subscriptions', () => {
  const baseline = getActiveSubscriptionCount()
  const store = reactive({ count: 7 })
  let watchEffects = 0

  function ServerComponent() {
    const state = useReactivity(() => store)
    useWatchEffect(() => {
      watchEffects++
    })
    return <span>{state.count}</span>
  }

  expect(renderToString(<ServerComponent />)).toContain('7')
  expect(watchEffects).toBe(0)
  expect(getActiveSubscriptionCount()).toBe(baseline)
})
