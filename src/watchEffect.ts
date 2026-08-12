/**
 * @module rue.watchEffect
 * @author Surmon <https://github.com/surmon-china>
 */

import { useEffect, useRef as useReactRef } from 'react'
import { watch as vueWatch } from '@vue/reactivity'
import type { WatchEffect, WatchHandle, DebuggerOptions } from '@vue/reactivity'
import { createWatchControl } from './_watchControl'

// changelog: https://github.com/vuejs/core/blob/main/CHANGELOG.md
// https://github.com/vuejs/core/blob/main/packages/runtime-core/src/apiWatch.ts
// https://github.com/vuejs/core/blob/main/packages/reactivity/src/watch.ts

export type WatchEffectOptions = DebuggerOptions

/**
 * Runs a function immediately while reactively tracking its dependencies and re-runs it whenever the dependencies are changed.
 *
 * @param effectFn - The effect function to run.
 * @param options - An optional options object that can be used to adjust the effect's flush timing or to debug the effect's dependencies; the `flush` option is not supported compared to Vue (3.5.0).
 * @see {@link https://vuejs.org/api/reactivity-core.html#watcheffect Vue `watchEffect()`}
 *
 * @example
 * ```js
 * const count = ref(0)
 * watchEffect(() => console.log(count.value))
 * // -> logs 0
 *
 * count.value++
 * // -> logs 1
 * ```
 */
export function watchEffect(effectFn: WatchEffect, options: WatchEffectOptions = {}): WatchHandle {
  return vueWatch(effectFn, null, {
    onTrack: options.onTrack,
    onTrigger: options.onTrigger,
    scheduler: (job) => job(),
  })
}

/**
 * Runs a function immediately while reactively tracking its dependencies and re-runs it whenever the dependencies are changed.
 *
 * @param effect - The effect function to run.
 * @param options - An optional options object that can be used to adjust the effect's flush timing or to debug the effect's dependencies; the `flush` option is not supported compared to Vue (3.5.0).
 * @see {@link https://vuejs.org/api/reactivity-core.html#watcheffect Vue `watchEffect()`}
 *
 * @example
 * ```js
 * const count = useRef(0)
 * useWatchEffect(() => console.log(count.value))
 * // -> logs 0
 *
 * count.value++
 * // -> logs 1
 * ```
 */
export const useWatchEffect: typeof watchEffect = (effect: any, options: WatchEffectOptions = {}) => {
  const effectRef = useReactRef(effect)
  const optionsRef = useReactRef(options)
  const committedEffectRef = useReactRef(effect)
  const runVersionRef = useReactRef(0)
  const committedRunVersionRef = useReactRef(0)
  const backingRef = useReactRef<WatchHandle | undefined>(undefined)
  const pendingRetrackVersionRef = useReactRef<number | null>(null)
  const replaceBackingRef = useReactRef<() => void>(() => undefined)
  const controlRef = useReactRef<ReturnType<typeof createWatchControl> | null>(null)
  if (controlRef.current === null) {
    controlRef.current = createWatchControl(() => {
      const pendingVersion = pendingRetrackVersionRef.current
      if (pendingVersion === null) return

      pendingRetrackVersionRef.current = null
      if (runVersionRef.current === pendingVersion) replaceBackingRef.current()
    })
  }
  const control = controlRef.current
  const runVersionAtRender = runVersionRef.current

  const createBacking = () =>
    watchEffect((onCleanup) => {
      runVersionRef.current++
      return effectRef.current(onCleanup)
    }, optionsRef.current)

  useEffect(() => {
    effectRef.current = effect
    optionsRef.current = options

    replaceBackingRef.current = () => {
      const backing = backingRef.current
      if (backing) {
        control.detach(backing)
        backing.stop()
      }

      if (control.stopped) {
        backingRef.current = undefined
        return
      }

      const nextBacking = createBacking()
      backingRef.current = nextBacking
      control.attach(nextBacking)
    }

    const backing = backingRef.current
    const effectChanged = committedEffectRef.current !== effect
    const ranBeforeRender = committedRunVersionRef.current !== runVersionAtRender
    const ranAfterRender = runVersionRef.current !== runVersionAtRender
    const needsRetrack = effectChanged && (!ranBeforeRender || ranAfterRender)
    if (backing && needsRetrack && !control.stopped) {
      if (control.paused) {
        pendingRetrackVersionRef.current = runVersionRef.current
      } else {
        replaceBackingRef.current()
      }
    } else if (effectChanged) {
      pendingRetrackVersionRef.current = null
    }

    committedEffectRef.current = effect
    committedRunVersionRef.current = runVersionRef.current
  })

  useEffect(() => {
    if (control.stopped) return

    const watchHandle = createBacking()
    backingRef.current = watchHandle
    control.attach(watchHandle)
    committedRunVersionRef.current = runVersionRef.current

    return () => {
      const backing = backingRef.current
      if (backing) {
        control.detach(backing)
        backing.stop()
        backingRef.current = undefined
      }
      pendingRetrackVersionRef.current = null
    }
  }, [control, options?.onTrack, options?.onTrigger])

  return control.handle
}
