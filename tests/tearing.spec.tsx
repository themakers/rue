import { forwardRef, startTransition, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { reactive, useReactivity } from '../src'

interface SchedulerMock {
  log?(value: unknown): void
  reset(): void
  unstable_clearLog?(): unknown[]
  unstable_clearYields?(): unknown[]
  unstable_flushAllWithoutAsserting(): boolean
  unstable_flushNumberOfYields(count: number): void
  unstable_yieldValue?(value: unknown): void
}

interface TestRenderer {
  toJSON(): unknown
  unmount(): void
  update(element: ReactNode): void
}

const require = createRequire(import.meta.url)
const rendererRoot = dirname(require.resolve('react-test-renderer/package.json'))
const schedulerPath = require.resolve('scheduler', { paths: [rendererRoot] })
const schedulerMockPath = require.resolve('scheduler/unstable_mock', { paths: [rendererRoot] })
const Scheduler = require(schedulerMockPath) as SchedulerMock
const log = Scheduler.log ?? Scheduler.unstable_yieldValue!
const clearLog = Scheduler.unstable_clearLog ?? Scheduler.unstable_clearYields!
require.cache[schedulerPath] = require.cache[schedulerMockPath]!
const { create } = require('react-test-renderer') as {
  create(element: ReactNode, options?: { unstable_isConcurrent?: boolean }): TestRenderer
}

afterEach(() => {
  Scheduler.reset()
})

test('an interleaved mutation cannot commit a torn transition', () => {
  const store = reactive({ count: 0 })
  const commits: string[] = []
  const root = create(null, { unstable_isConcurrent: true })
  Scheduler.unstable_flushAllWithoutAsserting()

  const Consumer = forwardRef<number, { label: string }>(function Consumer({ label }, ref) {
    const state = useReactivity(() => store)
    log(`${label}${state.count}`)
    useImperativeHandle(ref, () => state.count)
    return <span>{`${label}${state.count}`}</span>
  })

  function App() {
    const first = useRef<number>(null)
    const second = useRef<number>(null)
    const third = useRef<number>(null)
    useLayoutEffect(() => {
      commits.push(`A${first.current}B${second.current}C${third.current}`)
    })
    return (
      <>
        <Consumer ref={first} label="A" />
        <Consumer ref={second} label="B" />
        <Consumer ref={third} label="C" />
      </>
    )
  }

  startTransition(() => root.update(<App />))
  Scheduler.unstable_flushNumberOfYields(2)
  expect(clearLog()).toEqual(['A0', 'B0'])

  store.count = 1
  Scheduler.unstable_flushAllWithoutAsserting()

  expect(clearLog()).toEqual(['C1', 'A1', 'B1'])
  expect(commits).toEqual(['A1B1C1'])
  expect(root.toJSON()).toEqual([
    { type: 'span', props: {}, children: ['A1'] },
    { type: 'span', props: {}, children: ['B1'] },
    { type: 'span', props: {}, children: ['C1'] },
  ])
  root.unmount()
})
