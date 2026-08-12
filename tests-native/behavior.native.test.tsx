import { StrictMode, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import {
  onScopeDispose,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  reactive,
  ref,
  triggerRef,
  useComputed,
  useCustomRef,
  useEffectScope,
  useReactive,
  useReactivity,
  useReadonly,
  useRef,
  useShallowReactive,
  useShallowReadonly,
  useShallowRef,
  useWatch,
  useWatchEffect,
  watch,
} from '../src'
import { getActiveSubscriptionCount } from '../src/_subscription'

test('module store rerenders multiple native consumers in StrictMode', async () => {
  const baseline = getActiveSubscriptionCount()
  const store = reactive({ count: 0 })

  function Consumer({ testID }: { testID: string }) {
    const state = useReactivity(() => store)
    return <Text testID={testID}>{state.count}</Text>
  }

  const view = await render(
    <StrictMode>
      <View>
        <Consumer testID="first" />
        <Consumer testID="second" />
      </View>
    </StrictMode>,
  )

  await act(() => {
    store.count++
  })
  expect(screen.getByTestId('first').props.children).toBe(1)
  expect(screen.getByTestId('second').props.children).toBe(1)
  expect(getActiveSubscriptionCount()).toBe(baseline + 2)

  await view.unmount()
  expect(getActiveSubscriptionCount()).toBe(baseline)
})

test('component-owned reactive state updates from native events', async () => {
  function Counter() {
    const state = useReactive({ count: 0 })
    return (
      <Pressable accessibilityRole="button" onPress={() => state.count++}>
        <Text>{state.count}</Text>
      </Pressable>
    )
  }

  await render(<Counter />)
  await fireEvent.press(screen.getByRole('button'))
  expect(screen.getByText('1')).toBeTruthy()
})

test('native unmount stops useWatch', async () => {
  const source = ref(0)
  const values: number[] = []

  function Watcher() {
    useWatch(source, (value) => values.push(value))
    return <Text>watching</Text>
  }

  const view = await render(<Watcher />)
  await act(() => {
    source.value++
  })
  expect(values).toEqual([1])

  await view.unmount()
  source.value++
  expect(values).toEqual([1])
})

test('native StrictMode recreates and disposes effect scopes', async () => {
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
    return <Text>scoped</Text>
  }

  const view = await render(
    <StrictMode>
      <Scoped />
    </StrictMode>,
  )
  expect(runs).toBe(2)
  expect(disposals).toBe(1)

  await act(() => {
    source.value++
  })
  expect(changes).toBe(1)

  await view.unmount()
  expect(disposals).toBe(2)
  source.value++
  expect(changes).toBe(1)
})

test('native inline useWatchEffect runs once for each mutation', async () => {
  let runs = 0

  function Counter() {
    const count = useReactive({ value: 0 })
    useWatchEffect(() => {
      runs++
      void count.value
    })
    return (
      <Pressable accessibilityRole="button" onPress={() => count.value++}>
        <Text>{count.value}</Text>
      </Pressable>
    )
  }

  await render(<Counter />)
  expect(runs).toBe(1)
  await fireEvent.press(screen.getByRole('button'))
  expect(runs).toBe(2)
})

test('native ref variants preserve deep, shallow, and explicit trigger behavior', async () => {
  let renders = 0

  function Refs() {
    renders++
    const deep = useRef({ count: 0 })
    const shallow = useShallowRef({ count: 0 })
    const custom = useCustomRef<number>((track, trigger) => ({
      get() {
        track()
        return 1
      },
      set() {
        trigger()
      },
    }))

    return (
      <View>
        <Text testID="deep-ref">{deep.value.count}</Text>
        <Text testID="shallow-ref">{shallow.value.count}</Text>
        <Text testID="custom-ref">{custom.value}</Text>
        <Pressable testID="deep-ref-button" onPress={() => deep.value.count++} />
        <Pressable testID="shallow-ref-mutate" onPress={() => shallow.value.count++} />
        <Pressable testID="shallow-ref-trigger" onPress={() => triggerRef(shallow)} />
        <Pressable
          testID="custom-ref-button"
          onPress={() => {
            custom.value = 0
          }}
        />
      </View>
    )
  }

  await render(<Refs />)
  let before = renders
  await fireEvent.press(screen.getByTestId('deep-ref-button'))
  expect(screen.getByTestId('deep-ref').props.children).toBe(1)
  expect(renders).toBe(before + 1)

  before = renders
  await fireEvent.press(screen.getByTestId('shallow-ref-mutate'))
  expect(screen.getByTestId('shallow-ref').props.children).toBe(0)
  expect(renders).toBe(before)
  await fireEvent.press(screen.getByTestId('shallow-ref-trigger'))
  expect(screen.getByTestId('shallow-ref').props.children).toBe(1)
  expect(renders).toBe(before + 1)

  const beforeCustomTrigger = renders
  await fireEvent.press(screen.getByTestId('custom-ref-button'))
  expect(screen.getByTestId('custom-ref').props.children).toBe(1)
  expect(renders).toBe(beforeCustomTrigger + 1)
})

test('native reactive, readonly, and computed hooks rerender with their sources', async () => {
  const source = reactive({ count: 1 })
  let renders = 0

  function Values() {
    renders++
    const deep = useReactive({ nested: { count: 0 } })
    const shallow = useShallowReactive({ count: 0, nested: { count: 0 } })
    const readonly = useReadonly(source)
    const shallowReadonly = useShallowReadonly(source)
    const doubled = useComputed(() => deep.nested.count * 2)

    return (
      <View>
        <Text testID="hook-values">
          {deep.nested.count}:{shallow.count}:{shallow.nested.count}:{readonly.count}:{shallowReadonly.count}:
          {doubled.value}
        </Text>
        <Pressable testID="deep-reactive-button" onPress={() => deep.nested.count++} />
        <Pressable testID="shallow-nested-button" onPress={() => shallow.nested.count++} />
        <Pressable testID="shallow-root-button" onPress={() => shallow.count++} />
        <Pressable testID="readonly-source-button" onPress={() => source.count++} />
      </View>
    )
  }

  await render(<Values />)
  let before = renders
  await fireEvent.press(screen.getByTestId('deep-reactive-button'))
  expect(screen.getByTestId('hook-values').props.children.join('')).toBe('1:0:0:1:1:2')
  expect(renders).toBe(before + 1)

  before = renders
  await fireEvent.press(screen.getByTestId('shallow-nested-button'))
  expect(screen.getByTestId('hook-values').props.children.join('')).toBe('1:0:0:1:1:2')
  expect(renders).toBe(before)

  await fireEvent.press(screen.getByTestId('shallow-root-button'))
  expect(screen.getByTestId('hook-values').props.children.join('')).toBe('1:1:1:1:1:2')

  await fireEvent.press(screen.getByTestId('readonly-source-button'))
  expect(screen.getByTestId('hook-values').props.children.join('')).toBe('1:1:1:2:2:2')
})

test('native useWatch follows changed source and callback and honors immediate/once', async () => {
  const first = ref(0)
  const second = ref(0)
  const calls: string[] = []

  function Watcher({ source, label }: { source: typeof first; label: string }) {
    useWatch(source, (value) => calls.push(`${label}:${value}`), { immediate: true, once: true })
    return <Text>{label}</Text>
  }

  const view = await render(<Watcher source={first} label="first" />)
  expect(calls).toEqual(['first:0'])
  await view.rerender(<Watcher source={second} label="second" />)
  expect(calls).toEqual(['first:0', 'second:0'])

  await act(() => {
    first.value++
    second.value++
  })
  expect(calls).toEqual(['first:0', 'second:0'])
})

test('native useWatch observes deep changes and async store mutations rerender', async () => {
  const source = reactive({ nested: { count: 0 } })
  const values: number[] = []
  let renders = 0

  function AsyncValue() {
    const state = useReactivity(() => source)
    renders++
    useWatch(source, () => values.push(source.nested.count), { deep: true })
    return <Text testID="async-value">{state.nested.count}</Text>
  }

  await render(<AsyncValue />)
  const before = renders
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        source.nested.count++
        resolve()
      }, 0)
    })
  })
  expect(values).toEqual([1])
  expect(screen.getByTestId('async-value').props.children).toBe(1)
  expect(renders).toBe(before + 1)
})

test('native lifecycle uses latest callbacks and pairs mount cleanup', async () => {
  const events: string[] = []

  function Lifecycle({ label }: { label: string }) {
    const [count, setCount] = useState(0)
    onMounted(() => events.push('mounted'))
    onUpdated(() => events.push(`updated:${label}`))
    onBeforeUnmount(() => events.push(`unmounted:${label}`))
    return (
      <Pressable testID="lifecycle-button" onPress={() => setCount((value) => value + 1)}>
        <Text>{count}</Text>
      </Pressable>
    )
  }

  const view = await render(<Lifecycle label="first" />)
  await view.rerender(<Lifecycle label="second" />)
  await fireEvent.press(screen.getByTestId('lifecycle-button'))
  await view.unmount()
  expect(events).toEqual(['mounted', 'updated:second', 'updated:second', 'unmounted:second'])
})

test('native render subscription count returns to baseline after many unmounts', async () => {
  const baseline = getActiveSubscriptionCount()
  const source = reactive({ count: 0 })

  function Consumer() {
    const state = useReactivity(() => source)
    return <Text>{state.count}</Text>
  }

  const view = await render(
    <View>
      {Array.from({ length: 8 }, (_, index) => (
        <Consumer key={index} />
      ))}
    </View>,
  )
  expect(getActiveSubscriptionCount()).toBe(baseline + 8)
  await view.unmount()
  expect(getActiveSubscriptionCount()).toBe(baseline)
})
