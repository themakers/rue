# Veact fork audit

Audit date: 2026-08-12

## Scope and provenance

Rue starts from `veactjs/veact` commit
`846014f2b02d0d8bd5de7163af08def8c0758bfe`. At the time of the audit the
fork's tracked `master` branch is identical to that upstream revision.

The comparison target for the published package is `veact@1.0.0`. Its runtime
implementation matches the current source design: React rerenders are driven
by a reducer dispatch from Vue watchers. Neither the current source nor the
published runtime bundle imports `react-dom`, but the published manifest still
requires it as a peer dependency.

The fork preserves the MIT license and Surmon's original copyright attribution.

## Public API

The compatibility contract is the API exported by upstream `main`:

- all exports from `@vue/reactivity`;
- `baseWatch`, an alias for the unwrapped `@vue/reactivity` `watch`;
- `onMounted`, `onUpdated`, and `onBeforeUnmount`;
- `useRef`, `useShallowRef`, and `useCustomRef`;
- `useReactive` and `useShallowReactive`;
- `useReadonly` and `useShallowReadonly`;
- `useComputed`;
- `watch` and `useWatch`;
- `watchEffect` and `useWatchEffect`;
- `useEffectScope`;
- `useReactivity`.

`baseWatch` is retained even though it was omitted from the explicit API list
in the initial fork specification, because preserving the upstream `main` API
takes precedence.

The local `watch` and `watchEffect` wrappers deliberately run synchronously.
They do not expose Vue's renderer-dependent `flush` option. Rue must retain and
document that behavior.

## Source map

| File                 | Responsibility                   | React integration                   | Rerender/cleanup behavior                                      |
| -------------------- | -------------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| `src/index.ts`       | Public barrel and Vue re-exports | None                                | None                                                           |
| `src/_utils.ts`      | Internal types and force update  | `useReducer`                        | Reducer dispatch forces a render                               |
| `src/lifecycle.ts`   | Lifecycle helpers                | `useEffect`, `useRef`               | Passive setup and cleanup                                      |
| `src/ref.ts`         | Ref hooks                        | `useState`                          | Deep or shallow `useWatch` calls reducer dispatch              |
| `src/reactive.ts`    | Reactive object hooks            | `useState`                          | Whole-object Vue watcher calls reducer dispatch                |
| `src/readonly.ts`    | Readonly hooks                   | `useState`                          | Watches the readonly proxy                                     |
| `src/computed.ts`    | Computed hook                    | `useState`                          | Watches the computed ref                                       |
| `src/watch.ts`       | Sync watch wrapper and hook      | `useState`, indirect `useEffect`    | Watcher is created during render and stopped by effect cleanup |
| `src/watchEffect.ts` | Sync effect wrapper and hook     | `useState`, indirect `useEffect`    | Effect runs during render and is stopped by effect cleanup     |
| `src/effectScope.ts` | One-shot scope hook              | `useState`, `useRef`, `useCallback` | Scope is not stopped automatically                             |
| `src/reactivity.ts`  | Module-store adapter             | Indirect reducer/effect hooks       | Deep-watches the getter result                                 |
| `src/_logger.ts`     | Vue warning prefix               | None                                | Uses the cross-platform `console` global                       |

## Current subscription mechanism

The current implementation does not use `useSyncExternalStore`.

1. A hook creates its Vue value in a lazy `useState` initializer.
2. `useForceUpdate` obtains a `useReducer` dispatch.
3. `useWatch` creates a Vue watcher in another lazy `useState` initializer.
4. The watch scheduler runs synchronously and invokes the reducer dispatch.
5. A passive effect cleanup stops the watcher after unmount.

Subscription granularity is hook-level rather than render-read-level. A deep
`useRef`, `useReactive`, or `useReactivity` subscription watches the complete
source graph, while shallow variants preserve Vue's shallow behavior. This is
deterministic but can be more expensive than property-level tracking.

### Concurrent rendering verdict

The implementation is not safe for concurrent rendering:

- there is no stable snapshot or version counter;
- React cannot verify that mutable data stayed unchanged between render and
  commit;
- consumers of one module-level store receive independent reducer updates;
- a watcher created by an abandoned render can outlive that render;
- a mutation between render and commit is not covered by an external-store
  subscription contract.

Consequently, tearing is possible when shared reactive state changes during a
transition. All render subscriptions need a `useSyncExternalStore` adapter with
a stable numeric snapshot, `getServerSnapshot`, and an explicit solution for
the render-to-subscribe window.

## StrictMode and lifecycle

The implementation is not safe in React development StrictMode.

- Lazy state initializers may run twice, creating a discarded watcher whose
  handle is never stopped.
- StrictMode's effect cleanup stops the retained watcher, but the following
  effect setup does not create a replacement.
- `useWatchEffect` and immediate `useWatch` callbacks perform user side effects
  during render.
- `useEffectScope` can create discarded scopes and never stops its retained
  scope on unmount.
- `onUpdated` can treat StrictMode's second effect setup as an update to the
  initial mount.

Rue follows React's lifecycle semantics: development StrictMode may rehearse
effect setup and cleanup. The library guarantees paired cleanup, no orphaned
watchers, and no false initial `onUpdated`; it does not promise exactly one
`onMounted` callback in development.

`useEffect` is already used instead of `useLayoutEffect`. That is compatible
with React Native and avoids a server-rendering warning.

## Hook-specific findings

### Ref, reactive, readonly, and computed hooks

The Vue value is stable for the component lifetime and subsequent initializer
arguments are ignored, matching React state initializer semantics. The
associated watcher is unsafe because it is created during render.

`useReadonly` only receives change notifications when its underlying source is
reactive. A readonly wrapper around a plain object has no external mutation
channel and therefore cannot produce meaningful updates.

`useComputed` captures its initial getter/options. This matches the current
implementation but can produce stale prop closures. The compatibility decision
is to retain React initializer semantics: the computed object and its initial
getter/setter remain stable for the component lifetime. Forwarding arbitrary
inline closures would require render-time mutation or an additional update
commit, so applications should place changing inputs in Rue refs/reactive state
instead.

### `useWatch` and `useWatchEffect`

Both hooks capture their first callback, source, and options. Later renders do
not update those closures. They must be installed in commit-safe effects and
invoke current callbacks. Moving immediate execution out of render is a
necessary observable timing change and must be documented in `MIGRATION.md`.

### `useEffectScope`

The current hook replaces `scope.run` with a one-shot wrapper and does not stop
the scope on unmount. It needs automatic cleanup and a fresh active backing
scope after StrictMode's setup/cleanup rehearsal. The public Vue scope methods
(`pause`, `resume`, `stop`, and scope disposal) must remain usable.

### `useReactivity`

Each consumer creates an independent deep watcher and can remain subscribed to
the first getter while returning a value from a later getter. It needs a stable
subscription adapter and access to the latest getter result.

## Platform audit

The runtime source contains no references to:

- `react-dom`;
- `react-native`;
- `unstable_batchedUpdates`;
- `window`;
- `document`;
- `navigator`.

The only runtime dependencies are React, `@vue/reactivity`, and local modules.
`@vue/reactivity` is renderer-independent JavaScript based on Proxy, Reflect,
WeakMap, and Symbol, all supported by current Hermes releases.

Remaining packaging problems are:

- `react-dom` is incorrectly declared as a peer and build external;
- `@vue/reactivity` is a bundled dependency instead of a peer;
- the Vite build defaults to ESM plus UMD rather than ESM plus CJS;
- the TypeScript config includes DOM libraries and targets ES2020;
- there is no automated source and bundle platform-import check.

React Strict DOM is orthogonal to this state layer. Its acceptance requirement
is a smoke example using the same shared store as web and React Native.

## Published package and upstream reports

`veact@1.0.0` no longer exports `batchedUpdates` and its bundle has no hard
`react-dom` import. The historical renderer coupling survives only in package
metadata and build configuration.

Relevant upstream reports:

- `veactjs/veact#11`: reactivity stops under React 18 StrictMode;
- `veactjs/veact#5`: Fast Refresh and StrictMode subscription failures;
- `veactjs/veact#8`: React 18 update failure report;
- `veactjs/veact#9`: proposed observer/setup API and subscription fixes.

The PR introduces APIs outside Rue's scope and will not be merged wholesale.
The reports are used as regression-test inputs.

## Test baseline and gaps

The existing web tests cover the synchronous happy path for refs, reactive and
readonly values, computed refs, watch handles, watch cleanup, lifecycle hooks,
effect scope controls, and a single module-level store consumer.

Missing coverage includes:

- React StrictMode;
- transitions and tearing between multiple consumers;
- abandoned renders and the render-to-subscribe race;
- stale callback/source behavior;
- SSR and `getServerSnapshot`;
- React Native and Hermes;
- Fast Refresh lifecycle simulation;
- active-effect leak accounting;
- built package ESM/CJS and forbidden-import checks.

## Decision matrix

| Area                                  | Verdict        | Required action                                      |
| ------------------------------------- | -------------- | ---------------------------------------------------- |
| Vue re-exports and `baseWatch`        | Keep           | Preserve and type-test                               |
| Raw `watch`/`watchEffect`             | Keep           | Preserve synchronous scheduler                       |
| Reducer force update                  | Replace        | Use `useSyncExternalStore`                           |
| Render-time watcher creation          | Replace        | Install subscriptions/effects after commit           |
| Ref/reactive subscription granularity | Keep initially | Preserve deep/shallow behavior                       |
| Lifecycle hooks                       | Refactor       | Use latest callbacks and StrictMode-safe bookkeeping |
| `useEffectScope`                      | Refactor       | Automatic and repeatable lifecycle cleanup           |
| `react-dom` runtime peer              | Remove         | Keep only as a web test dependency                   |
| `@vue/reactivity` dependency          | Change         | Peer dependency plus pinned dev dependency           |
| UMD/browser build                     | Remove         | Emit one platform-neutral ESM/CJS pair               |
| Manual batching                       | Do not add     | Rely on React 18+ automatic batching                 |

## Phase 0 conclusion

The core Vue reactivity package is suitable for web, React Native, Hermes, and
React Strict DOM. The upstream glue layer is platform-neutral at source level,
but it is not compatible with React StrictMode or concurrent rendering as-is.
The subscription lifecycle, watcher hooks, and effect scope require a focused
refactor. No renderer-specific entry points or batching APIs are needed.
