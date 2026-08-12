/**
 * @module rue.reactivity
 * @author Surmon <https://github.com/surmon-china>
 */

import { useReactiveSubscription } from './_subscription'

/**
 * Converts some of the 'raw Vue' data, which is not already wrapped in a hook,
 * into reactive hook data to ensure proper reactivity within the component.
 *
 * @param getter - A function that returns the data to be deeply watched.
 * @example
 * ```tsx
 * import React from 'react'
 * import { ref, useReactivity } from '@themakers/rue'
 *
 * const countRef = ref(0)
 *
 * export const Component: React.FC = () => {
 *   // Convert to a reactivity hook
 *   const count = useReactivity(() => countRef)
 *   const increment = () => {
 *     count.value++
 *   }
 *
 *   return (
 *     <div>
 *       <span>{count.value}</span>
 *       <button onClick={increment}>Increment</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useReactivity<T = any>(getter: () => T): T {
  // deep > watch > traverse(getter()) > ref | array | set | map | plain object(reactive) > force update
  useReactiveSubscription(() => getter(), { deep: true })
  return getter()
}
