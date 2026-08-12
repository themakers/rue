import { StrictMode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import {
  onScopeDispose,
  reactive,
  ref,
  useEffectScope,
  useReactive,
  useReactivity,
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
