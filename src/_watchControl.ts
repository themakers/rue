import type { WatchHandle } from '@vue/reactivity'

export interface WatchControl {
  readonly handle: WatchHandle
  readonly paused: boolean
  readonly stopped: boolean
  attach(handle: WatchHandle): void
  detach(handle: WatchHandle): void
}

export function createWatchControl(onResume?: () => void): WatchControl {
  let backing: WatchHandle | undefined
  let paused = false
  let stopped = false

  const stop = () => {
    if (stopped) return
    stopped = true
    backing?.stop()
    backing = undefined
  }

  const handle = stop as WatchHandle
  handle.stop = stop
  handle.pause = () => {
    paused = true
    backing?.pause()
  }
  handle.resume = () => {
    if (stopped) return
    paused = false
    backing?.resume()
    onResume?.()
  }

  return {
    handle,
    get stopped() {
      return stopped
    },
    get paused() {
      return paused
    },
    attach(nextHandle) {
      if (stopped) {
        nextHandle.stop()
        return
      }

      backing = nextHandle
      if (paused) backing.pause()
    },
    detach(currentHandle) {
      if (backing === currentHandle) backing = undefined
    },
  }
}
