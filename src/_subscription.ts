import { useMemo, useState, useSyncExternalStore } from 'react'
import { isReactive, isReadonly, isRef, isShallow, ReactiveEffect, traverse } from '@vue/reactivity'
import type { DebuggerOptions, WatchSource } from '@vue/reactivity'

interface SubscriptionOptions extends DebuggerOptions {
  deep?: boolean | number
}

type SubscriptionSource = WatchSource<unknown> | object

interface VersionStore {
  subscribe(listener: () => void): () => void
  getSnapshot(): number
  getServerSnapshot(): number
}

interface VersionClock {
  value: number
}

interface Capture {
  notifyOnTrigger: boolean
  values: unknown[]
}

let activeSubscriptionCount = 0
const noInitialValue = Symbol('no initial value')

export const getActiveSubscriptionCount = () => activeSubscriptionCount

function captureValue(root: unknown, options: SubscriptionOptions, structuralRoot = false): Capture {
  const snapshot: unknown[] = []
  const seen = new WeakMap<object, number>()
  let notifyOnTrigger = false
  let nextSeenId = 0
  const configuredDepth =
    options.deep === true ? Infinity : typeof options.deep === 'number' ? options.deep : undefined
  const depth =
    configuredDepth ??
    (isRef(root) ? 1 : isReactive(root) || isReadonly(root) ? (isShallow(root) ? 1 : Infinity) : 0)

  const visit = (
    value: unknown,
    remainingDepth: number,
    identityContext: boolean,
    structuralSelf = false,
  ) => {
    if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
      snapshot.push(value)
      return
    }

    const includeIdentity =
      !structuralSelf && (identityContext || isRef(value) || isReactive(value) || isReadonly(value))
    if (includeIdentity) snapshot.push(value)
    if (isRef(value) && !('effect' in value)) notifyOnTrigger = true
    if (remainingDepth <= 0) return

    const object = value as object
    const existing = seen.get(object)
    if (existing !== undefined) {
      snapshot.push(0, existing)
      return
    }
    seen.set(object, nextSeenId++)
    const childIdentityContext = includeIdentity

    if (isRef(value)) {
      snapshot.push(1)
      visit(value.value, remainingDepth - 1, childIdentityContext)
      return
    }

    if (Array.isArray(value)) {
      snapshot.push(2, value.length)
      for (let index = 0; index < value.length; index++) {
        const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index))
        if (!descriptor) {
          snapshot.push(3)
        } else if ('value' in descriptor) {
          visit(descriptor.value, remainingDepth - 1, childIdentityContext)
        } else {
          visit(Reflect.get(value, String(index)), remainingDepth - 1, childIdentityContext)
        }
      }
      return
    }

    if (value instanceof Map) {
      snapshot.push(4, value.size)
      for (const [key, item] of value) {
        visit(key, remainingDepth - 1, childIdentityContext)
        visit(item, remainingDepth - 1, childIdentityContext)
      }
      return
    }

    if (value instanceof Set) {
      snapshot.push(5, value.size)
      for (const item of value) visit(item, remainingDepth - 1, childIdentityContext)
      return
    }

    if (value instanceof Date) {
      snapshot.push(7, value.getTime())
      return
    }

    if (value instanceof RegExp) {
      snapshot.push(8, value.source, value.flags, value.lastIndex)
      return
    }

    const tag = Object.prototype.toString.call(value)
    if (!isReactive(value) && !isReadonly(value) && tag !== '[object Object]') {
      snapshot.push(9, tag, String(value))
      notifyOnTrigger = true
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
        visit(descriptor.value, remainingDepth - 1, childIdentityContext)
      } else {
        const accessorValue = Reflect.get(value, key)
        const nextAccessorValue = Reflect.get(value, key)
        visit(accessorValue, remainingDepth - 1, false, !Object.is(accessorValue, nextAccessorValue))
      }
    }
  }

  visit(root, depth, !structuralRoot || isRef(root) || isReactive(root) || isReadonly(root), structuralRoot)
  return { notifyOnTrigger, values: snapshot }
}

function captureSource(source: SubscriptionSource, options: SubscriptionOptions): Capture {
  return captureValue(typeof source === 'function' ? source() : source, options)
}

function trackValue(root: unknown, options: SubscriptionOptions, structuralRoot: boolean): Capture {
  const configuredDepth =
    options.deep === true ? Infinity : typeof options.deep === 'number' ? options.deep : undefined
  const depth =
    configuredDepth ??
    (isRef(root) ? 1 : isReactive(root) || isReadonly(root) ? (isShallow(root) ? 1 : Infinity) : 0)

  traverse(root, depth)
  return captureValue(root, options, structuralRoot)
}

function snapshotsEqual(left: Capture, right: Capture): boolean {
  return (
    left.values.length === right.values.length &&
    left.values.every((value, index) => Object.is(value, right.values[index]))
  )
}

function createVersionStore(
  source: SubscriptionSource,
  options: SubscriptionOptions,
  clock: VersionClock,
  initialValue: unknown = noInitialValue,
): VersionStore {
  let effect: ReactiveEffect<Capture> | undefined
  let structuralRoot = false
  let renderedSnapshot =
    initialValue === noInitialValue ? captureSource(source, options) : captureValue(initialValue, options)
  const structuralRenderedSnapshot =
    initialValue === noInitialValue ? renderedSnapshot : captureValue(initialValue, options, true)
  const listeners = new Set<() => void>()

  const invalidate = () => {
    const nextSnapshot = effect!.run()
    if (!renderedSnapshot.notifyOnTrigger && snapshotsEqual(renderedSnapshot, nextSnapshot)) return

    renderedSnapshot = nextSnapshot
    clock.value++
    for (const listener of [...listeners]) listener()
  }

  const start = () => {
    let classifyRoot = typeof source === 'function' && initialValue !== noInitialValue
    effect = new ReactiveEffect(() => {
      const root = typeof source === 'function' ? source() : source
      if (classifyRoot) {
        structuralRoot = typeof source === 'function' && !Object.is(root, source())
        classifyRoot = false
        if (structuralRoot) renderedSnapshot = structuralRenderedSnapshot
      }
      return trackValue(root, options, structuralRoot)
    })
    effect.scheduler = invalidate
    effect.onTrack = options.onTrack
    effect.onTrigger = options.onTrigger
    let subscribedSnapshot: Capture
    try {
      subscribedSnapshot = effect.run()
    } catch (error) {
      effect.stop()
      effect = undefined
      throw error
    }
    activeSubscriptionCount++
    if (!snapshotsEqual(renderedSnapshot, subscribedSnapshot)) {
      clock.value++
      renderedSnapshot = subscribedSnapshot
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1) {
        try {
          start()
        } catch (error) {
          listeners.delete(listener)
          throw error
        }
      }

      let subscribed = true
      return () => {
        if (!subscribed) return
        subscribed = false
        listeners.delete(listener)

        if (listeners.size === 0) {
          effect?.stop()
          if (effect) activeSubscriptionCount--
          effect = undefined
        }
      }
    },
    getSnapshot: () => clock.value,
    getServerSnapshot: () => clock.value,
  }
}

export function useReactiveSubscription(
  source: SubscriptionSource,
  options: SubscriptionOptions = {},
  initialValue: unknown = noInitialValue,
): void {
  const [clock] = useState<VersionClock>(() => ({ value: 0 }))
  const store = useMemo(
    () => createVersionStore(source, options, clock, initialValue),
    [clock, source, options.deep, options.onTrack, options.onTrigger],
  )
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}
