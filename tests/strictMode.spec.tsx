import { StrictMode, Suspense } from 'react'
import { act, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import {
  onBeforeUnmount,
  onMounted,
  onScopeDispose,
  onUpdated,
  reactive,
  ref,
  useEffectScope,
  useReactivity,
  useWatchEffect,
  watch,
} from '../src'
import { getActiveSubscriptionCount } from '../src/_subscription'

test('StrictMode rehearses lifecycle without leaking subscriptions or false updates', () => {
  const baseline = getActiveSubscriptionCount()
  const store = reactive({ count: 0 })
  let mounts = 0
  let unmounts = 0
  let updates = 0
  let watchRuns = 0
  let watchCleanups = 0

  const watchStore = (onCleanup: (cleanup: () => void) => void) => {
    watchRuns++
    void store.count
    onCleanup(() => watchCleanups++)
  }

  function Consumer() {
    const state = useReactivity(() => store)
    onMounted(() => mounts++)
    onUpdated(() => updates++)
    onBeforeUnmount(() => unmounts++)
    useWatchEffect(watchStore)
    return <span>{state.count}</span>
  }

  const view = render(
    <StrictMode>
      <Consumer />
    </StrictMode>,
  )

  expect(screen.getByText('0')).toBeTruthy()
  expect(mounts).toBe(2)
  expect(unmounts).toBe(1)
  expect(updates).toBe(0)
  expect(watchRuns).toBe(2)
  expect(watchCleanups).toBe(1)
  expect(getActiveSubscriptionCount()).toBe(baseline + 1)

  act(() => store.count++)
  expect(screen.getByText('1')).toBeTruthy()
  expect(updates).toBe(1)

  view.rerender(
    <StrictMode>
      <Consumer />
    </StrictMode>,
  )
  expect(getActiveSubscriptionCount()).toBe(baseline + 1)

  view.unmount()
  expect(unmounts).toBe(2)
  expect(watchCleanups).toBe(3)
  expect(getActiveSubscriptionCount()).toBe(baseline)
})

test('effect scope gets a fresh backing scope and always disposes it', () => {
  const source = ref(0)
  let runs = 0
  let changes = 0
  let disposals = 0

  function Scoped() {
    const scope = useEffectScope()
    scope.run(() => {
      runs++
      watch(source, () => changes++)
      onScopeDispose(() => disposals++)
    })
    return null
  }

  const view = render(
    <StrictMode>
      <Scoped />
    </StrictMode>,
  )

  expect(runs).toBe(2)
  expect(disposals).toBe(1)
  act(() => source.value++)
  expect(changes).toBe(1)

  view.unmount()
  expect(disposals).toBe(2)
  act(() => source.value++)
  expect(changes).toBe(1)
})

test('an abandoned render creates no Vue subscription', () => {
  const baseline = getActiveSubscriptionCount()
  const error = console.error
  console.error = () => undefined
  const suppressExpectedError = (event: ErrorEvent) => {
    if (event.error instanceof Error && event.error.message === 'abandoned') event.preventDefault()
  }
  window.addEventListener('error', suppressExpectedError)

  function Broken() {
    useReactivity(() => reactive({ count: 0 }))
    throw new Error('abandoned')
    return null
  }

  try {
    expect(() => render(<Broken />)).toThrow('abandoned')
    expect(getActiveSubscriptionCount()).toBe(baseline)
  } finally {
    window.removeEventListener('error', suppressExpectedError)
    console.error = error
  }
})

test('Fast Refresh style rerenders replace subscriptions without leaks', () => {
  const baseline = getActiveSubscriptionCount()
  const store = reactive({ count: 0 })

  function Consumer({ revision }: { revision: number }) {
    const state = useReactivity(() => store)
    return (
      <span>
        {revision}:{state.count}
      </span>
    )
  }

  const view = render(<Consumer revision={1} />)
  expect(getActiveSubscriptionCount()).toBe(baseline + 1)

  view.rerender(<Consumer revision={2} />)
  view.rerender(<Consumer revision={3} />)
  expect(getActiveSubscriptionCount()).toBe(baseline + 1)

  act(() => store.count++)
  expect(screen.getByText('3:1')).toBeTruthy()

  view.unmount()
  expect(getActiveSubscriptionCount()).toBe(baseline)
})

test('a suspended render subscribes only after a successful retry', async () => {
  const baseline = getActiveSubscriptionCount()
  const store = reactive({ count: 0 })
  let ready = false
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = () => {
      ready = true
      resolve()
    }
  })

  function Consumer() {
    const state = useReactivity(() => store)
    if (!ready) throw gate
    return <span>ready:{state.count}</span>
  }

  const view = render(
    <Suspense fallback={<span>waiting</span>}>
      <Consumer />
    </Suspense>,
  )
  expect(screen.getByText('waiting')).toBeTruthy()
  expect(getActiveSubscriptionCount()).toBe(baseline)

  act(() => store.count++)
  await act(async () => release())

  expect(screen.getByText('ready:1')).toBeTruthy()
  expect(getActiveSubscriptionCount()).toBe(baseline + 1)

  view.unmount()
  expect(getActiveSubscriptionCount()).toBe(baseline)
})
