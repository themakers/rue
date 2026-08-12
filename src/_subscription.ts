import { useRef as useReactRef, useSyncExternalStore } from 'react'
import { isReactive, isReadonly, isRef, isShallow, watch as vueWatch } from '@vue/reactivity'
import type { DebuggerOptions, WatchHandle, WatchSource } from '@vue/reactivity'

interface SubscriptionOptions extends DebuggerOptions {
  deep?: boolean | number
}

type SubscriptionSource = WatchSource<unknown> | object

interface VersionStore {
  subscribe(listener: () => void): () => void
  getSnapshot(): number
  getServerSnapshot(): number
}

interface StoreState {
  source: SubscriptionSource
  options: SubscriptionOptions
  store: VersionStore
}

let activeSubscriptionCount = 0

export const getActiveSubscriptionCount = () => activeSubscriptionCount

function captureSource(source: SubscriptionSource, options: SubscriptionOptions): unknown[] {
  const root = typeof source === 'function' ? source() : source
  const snapshot: unknown[] = []
  const seen = new WeakMap<object, number>()
  let nextSeenId = 0
  const configuredDepth =
    options.deep === true ? Infinity : typeof options.deep === 'number' ? options.deep : undefined
  const depth =
    configuredDepth ??
    (isRef(root) ? 1 : isReactive(root) || isReadonly(root) ? (isShallow(root) ? 1 : Infinity) : 0)

  const visit = (value: unknown, remainingDepth: number, includeIdentity: boolean) => {
    if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
      snapshot.push(value)
      return
    }

    if (includeIdentity) snapshot.push(value)
    if (remainingDepth <= 0) return

    const object = value as object
    const existing = seen.get(object)
    if (existing !== undefined) {
      snapshot.push(0, existing)
      return
    }
    seen.set(object, nextSeenId++)

    if (isRef(value)) {
      snapshot.push(1)
      visit(value.value, remainingDepth - 1, true)
      return
    }

    if (Array.isArray(value)) {
      snapshot.push(2, value.length)
      for (let index = 0; index < value.length; index++) {
        const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index))
        if (!descriptor) {
          snapshot.push(3)
        } else if ('value' in descriptor) {
          visit(descriptor.value, remainingDepth - 1, true)
        } else {
          visit(Reflect.get(value, String(index)), remainingDepth - 1, true)
        }
      }
      return
    }

    if (value instanceof Map) {
      snapshot.push(4, value.size)
      for (const [key, item] of value) {
        visit(key, remainingDepth - 1, true)
        visit(item, remainingDepth - 1, true)
      }
      return
    }

    if (value instanceof Set) {
      snapshot.push(5, value.size)
      for (const item of value) visit(item, remainingDepth - 1, true)
      return
    }

    const keys = Reflect.ownKeys(value).filter(
      (key) => Reflect.getOwnPropertyDescriptor(value, key)?.enumerable,
    )
    snapshot.push(6, keys.length)
    for (const key of keys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key)!
      snapshot.push(key)
      if ('value' in descriptor) {
        visit(descriptor.value, remainingDepth - 1, true)
      } else {
        visit(Reflect.get(value, key), remainingDepth - 1, true)
      }
    }
  }

  visit(root, depth, isRef(root) || isReactive(root) || isReadonly(root))
  return snapshot
}

function snapshotsEqual(left: unknown[], right: unknown[]): boolean {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
}

function createVersionStore(
  source: SubscriptionSource,
  options: SubscriptionOptions,
  initialVersion = 0,
): VersionStore {
  let version = initialVersion
  let watcher: WatchHandle | undefined
  let renderedSnapshot = captureSource(source, options)
  const listeners = new Set<() => void>()

  const invalidate = () => {
    version++
    renderedSnapshot = captureSource(source, options)
    for (const listener of [...listeners]) listener()
  }

  const start = () => {
    watcher = vueWatch(source as WatchSource<unknown>, invalidate, {
      deep: options.deep,
      onTrack: options.onTrack,
      onTrigger: options.onTrigger,
      scheduler: (job) => job(),
    })
    activeSubscriptionCount++

    const subscribedSnapshot = captureSource(source, options)
    if (!snapshotsEqual(renderedSnapshot, subscribedSnapshot)) {
      version++
      renderedSnapshot = subscribedSnapshot
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1) start()

      let subscribed = true
      return () => {
        if (!subscribed) return
        subscribed = false
        listeners.delete(listener)

        if (listeners.size === 0) {
          watcher?.stop()
          if (watcher) activeSubscriptionCount--
          watcher = undefined
        }
      }
    },
    getSnapshot: () => version,
    getServerSnapshot: () => version,
  }
}

export function useReactiveSubscription(source: SubscriptionSource, options: SubscriptionOptions = {}): void {
  const stateRef = useReactRef<StoreState | null>(null)
  const previous = stateRef.current
  const optionsChanged =
    previous !== null &&
    (previous.options.deep !== options.deep ||
      previous.options.onTrack !== options.onTrack ||
      previous.options.onTrigger !== options.onTrigger)

  if (previous === null || previous.source !== source || optionsChanged) {
    stateRef.current = {
      source,
      options,
      store: createVersionStore(source, options, previous?.store.getSnapshot()),
    }
  }

  const store = stateRef.current!.store
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}
