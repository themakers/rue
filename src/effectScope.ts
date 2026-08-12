/**
 * @module rue.effectScope
 * @author Surmon <https://github.com/surmon-china>
 */

import { useEffect, useRef as useReactRef } from 'react'
import { effectScope as vueEffectScope } from '@vue/reactivity'
import type { EffectScope } from '@vue/reactivity'
import type { ArgumentTypes } from './_utils'

interface ScopeControl {
  facade: EffectScope
  setup?: () => unknown
  backing?: EffectScope
  paused: boolean
  stopped: boolean
}

function createScopeControl(): ScopeControl {
  const facade = vueEffectScope(true)
  facade.stop()

  const control: ScopeControl = {
    facade,
    paused: false,
    stopped: false,
  }

  Object.defineProperty(facade, 'active', {
    configurable: true,
    get: () => control.backing?.active ?? false,
  })

  facade.run = <T>(fn: () => T): T | undefined => {
    if (!control.setup && !control.stopped) control.setup = fn
    return undefined
  }
  facade.pause = () => {
    control.paused = true
    control.backing?.pause()
  }
  facade.resume = () => {
    if (control.stopped) return
    control.paused = false
    control.backing?.resume()
  }
  facade.stop = () => {
    if (control.stopped) return
    control.stopped = true
    control.backing?.stop()
    control.backing = undefined
  }

  return control
}

/**
 * Creates a component-owned effect scope. `scope.run(setup)` registers setup
 * during render; React executes it after commit and stops it on cleanup.
 */
export function useEffectScope(...args: ArgumentTypes<typeof vueEffectScope>): EffectScope {
  const controlRef = useReactRef<ScopeControl | null>(null)
  if (controlRef.current === null) controlRef.current = createScopeControl()
  const control = controlRef.current

  useEffect(() => {
    if (!control.setup || control.stopped) return

    const backing = vueEffectScope(...args)
    control.backing = backing

    try {
      backing.run(control.setup)
      if (control.paused) backing.pause()
    } catch (error) {
      backing.stop()
      control.backing = undefined
      throw error
    }

    return () => {
      backing.stop()
      if (control.backing === backing) control.backing = undefined
    }
  }, [control])

  return control.facade
}
