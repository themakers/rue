# Rue

Vue's mutable reactivity model for React on the web and React Native.

Rue re-exports `@vue/reactivity` and adds React hooks that connect refs,
reactive objects, computed values, watchers, and effect scopes to the React
lifecycle. Rendering stays ordinary React and JSX.

```tsx
import { useComputed, useReactive } from '@themakers/rue'

export function Counter() {
  const state = useReactive({ count: 0 })
  const doubled = useComputed(() => state.count * 2)

  return (
    <button onClick={() => state.count++}>
      {state.count} / {doubled.value}
    </button>
  )
}
```

## Platforms

| Platform                | Status             | Validation                                              |
| ----------------------- | ------------------ | ------------------------------------------------------- |
| React DOM               | Supported          | Vitest, jsdom, Vite example                             |
| React Native            | Supported          | `jest-expo`, React Native Testing Library, Expo example |
| Hermes                  | Supported          | Hermes bytecode compile and Expo Android Hermes bundle  |
| React Strict DOM        | Supported          | Expo + RSD example and Android Hermes bundle            |
| SSR                     | Architecture-ready | `getServerSnapshot` and `renderToString` smoke test     |
| React Server Components | Not supported      | Outside the current scope                               |

The runtime imports only `react` and `@vue/reactivity`. It has no dependency on
`react-dom`, `react-native`, browser globals, or renderer-specific batching.

## Installation

```sh
pnpm add @themakers/rue react @vue/reactivity
```

Rue can also be installed directly from a pinned git commit before an npm
release exists:

```json
{
  "dependencies": {
    "@themakers/rue": "github:themakers/rue#<commit-sha>"
  }
}
```

The repository does not commit `dist`. During a standard npm or pnpm git
installation, the package manager installs Rue's build-time dependencies and
runs `prepare` to generate `dist` inside the installed package. `prepack`
performs the same build and validates the output before creating a package
tarball. Pin a commit SHA so installs remain reproducible.

Requirements:

- React 18 or 19;
- `@vue/reactivity` 3.5.x;
- Proxy support, available in current browsers and Hermes.

CI tests the minimum React 18.3.1 peer, the latest React 19 web release, and the
React/React Native versions pinned by the current Expo SDK. Expo applications
should follow Expo's renderer version matrix rather than upgrading React Native
independently.

`react` and `@vue/reactivity` are peer dependencies. Ensure the application has
only one resolved copy of `@vue/reactivity`, especially when Vue and Rue are
installed together. Separate copies maintain separate dependency graphs, so a
value created by one copy cannot notify effects owned by another.

## API

Rue exports the complete public API of `@vue/reactivity`, plus:

| API                  | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `onMounted`          | Passive effect setup after mount                           |
| `onUpdated`          | Passive effect after every commit except the initial mount |
| `onBeforeUnmount`    | Passive effect cleanup                                     |
| `useRef`             | Component-owned deep Vue ref                               |
| `useShallowRef`      | Component-owned shallow Vue ref                            |
| `useTemplateRef`     | Vue-style ref that binds directly to a JSX `ref`           |
| `useCustomRef`       | Component-owned custom Vue ref                             |
| `useReactive`        | Component-owned deep reactive object                       |
| `useShallowReactive` | Component-owned shallow reactive object                    |
| `useReadonly`        | Readonly view subscribed to its reactive source            |
| `useShallowReadonly` | Shallow readonly view                                      |
| `useComputed`        | Component-owned computed ref                               |
| `watch`              | Synchronous Vue watch wrapper                              |
| `baseWatch`          | Direct `@vue/reactivity` watch export                      |
| `useWatch`           | Component-owned watch with automatic cleanup               |
| `watchEffect`        | Synchronous Vue watch effect wrapper                       |
| `useWatchEffect`     | Component-owned watch effect with automatic cleanup        |
| `useEffectScope`     | Component-owned effect scope facade                        |
| `useReactivity`      | Subscribe a component to module-level reactive data        |

## Component state

```tsx
import { useComputed, useReactive, useRef, useWatch } from '@themakers/rue'

export function Profile() {
  const name = useRef('Ada')
  const state = useReactive({ visits: 0 })
  const label = useComputed(() => `${name.value}: ${state.visits}`)

  useWatch(
    () => state.visits,
    (visits) => console.log('visits', visits),
  )

  return <button onClick={() => state.visits++}>{label.value}</button>
}
```

Initial arguments follow React state initializer semantics: changing an
initializer on a later render does not replace the existing ref, proxy, or
computed object.

## Template refs

`useTemplateRef` provides one ref for both JSX binding and Vue-style access.
React's renderer writes through the internal `.current` bridge while application
code reads the same element through `.value`:

```tsx
import { onMounted, useTemplateRef } from '@themakers/rue'

export function AutofocusInput() {
  const input = useTemplateRef<HTMLInputElement>()

  onMounted(() => input.value?.focus())
  return <input ref={input} />
}
```

The ref starts at `null`, receives the host element after commit, and returns to
`null` when the element unmounts.

## Shared stores

Create a normal Vue reactive value at module scope and subscribe each consumer
with `useReactivity`:

```tsx
import { computed, reactive, useReactivity } from '@themakers/rue'

const counter = reactive({ count: 0 })
const doubled = computed(() => counter.count * 2)

export function Counter() {
  const state = useReactivity(() => ({ counter, doubled }))

  return (
    <button onClick={() => state.counter.count++}>
      {state.counter.count} / {state.doubled.value}
    </button>
  )
}
```

Rue uses `useSyncExternalStore` with a stable numeric version snapshot. A
reactive mutation invalidates subscribed components synchronously, allowing
React to detect an external-store change during a transition and restart the
render before commit.

Do not mutate external stores during render. For SSR, create request-local
stores rather than sharing a mutable singleton between requests.

## Watchers

Raw `watch` and `watchEffect` run synchronously and return the Vue watch handle.
Their hook variants are installed after commit and stop automatically during
cleanup:

```tsx
useWatchEffect((onCleanup) => {
  const request = loadItem(itemId.value)
  onCleanup(() => request.abort())
})
```

Vue's `flush` option is intentionally not supported. Rue has no Vue renderer
scheduler and does not emulate one with platform-specific APIs.

In development StrictMode, React may rehearse setup and cleanup. User effects
must follow the same idempotency rules as `useEffect`; Rue guarantees that each
backing watcher is stopped and that no discarded render leaves a watcher.

## Effect scopes

`scope.run(setup)` registers setup during render. Rue executes it after commit
inside a fresh Vue effect scope and stops that backing scope during cleanup:

```tsx
import { onScopeDispose, useEffectScope, watch } from '@themakers/rue'

const scope = useEffectScope()
scope.run(() => {
  const handle = watch(source, consume)
  onScopeDispose(() => console.log('scope disposed'))
  return handle
})
```

Because setup is deferred, `scope.run()` returns `undefined`. `pause`, `resume`,
and `stop` operate on the active backing scope. StrictMode can execute the setup
more than once with a complete disposal between runs.

## Lifecycle

Lifecycle helpers use passive React effects. Their development StrictMode
semantics intentionally match React:

- `onMounted` setup may run twice;
- `onBeforeUnmount` may observe the rehearsal cleanup and the real cleanup;
- `onUpdated` never fires for either initial-mount setup, then runs after later
  commits.

## Examples

The workspace contains three applications using the exact same
`examples/shared-store` package:

```sh
pnpm --filter @rue/example-web dev
pnpm --filter @rue/example-expo start
pnpm --filter @rue/example-expo-rsd start
```

Each renderer also includes component-owned TODO state built with `useReactive`,
alongside the shared module store consumed through `useReactivity`.

Validate all examples:

```sh
pnpm examples:check
pnpm examples:bundle
```

The Expo Strict DOM example also includes an EAS Android + Maestro workflow that
asserts the app is executing on Hermes and that a Rue mutation updates the UI.

## Development

```sh
pnpm install
pnpm run ci
```

Contributors need Node 22.13 or newer for the current Expo toolchain. The
published ES2017 runtime itself supports Node 18+ and does not execute Node APIs
inside applications.

Useful focused commands:

```sh
pnpm test:web
pnpm test:native
pnpm test:hermes
pnpm test:coverage
pnpm check:platform
pnpm check:size
```

See [`docs/audit.md`](docs/audit.md),
[`docs/architecture.md`](docs/architecture.md), and
[`MIGRATION.md`](MIGRATION.md) for design and compatibility details.

## License

MIT. Rue is a fork of [Veact](https://github.com/veactjs/veact) and preserves
the original copyright and attribution.
