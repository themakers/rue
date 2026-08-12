# Migrating from Veact

Rue preserves the public API of `veact` `main`, including `baseWatch` and all
`@vue/reactivity` re-exports. The differences below are required for React
StrictMode, concurrent rendering, and React Native support.

## Package name

```diff
- import { useReactive } from 'veact'
+ import { useReactive } from '@themakers/rue'
```

Rue requires React 18 or 19 and `@vue/reactivity` 3.5.x. `react-dom` is not a
peer dependency.

## Rendering subscriptions

Veact dispatched a reducer update from a Vue watcher created during render.
Rue subscribes with `useSyncExternalStore` and a numeric version snapshot. This
prevents abandoned render effects and allows React to check mutable external
state before a concurrent commit.

Subscription remains hook-level and keeps Veact's deep/shallow behavior.

## Hook watcher timing

Veact created `useWatch` and `useWatchEffect` watchers during render. Immediate
callbacks and watch effects could therefore execute before commit, during SSR,
and in renders React later discarded.

Rue creates them in a passive effect:

- `useWatch(..., { immediate: true })` runs after commit;
- `useWatchEffect` first runs after commit;
- neither hook runs during server rendering;
- changing a `useWatch` source replaces its backing watcher;
- callback calls use the latest committed callback;
- cleanup is paired under StrictMode and Fast Refresh.

Raw `watch` and `watchEffect` remain synchronous.

## Effect scopes

Veact executed the first `scope.run(fn)` call synchronously during render and
returned `fn`'s result. It did not stop the scope automatically.

Rue treats `scope.run(fn)` as setup registration:

- setup runs after commit;
- `scope.run` returns `undefined`;
- component cleanup stops the backing scope;
- StrictMode creates a fresh backing scope after rehearsal cleanup;
- `pause`, `resume`, `stop`, and `onScopeDispose` continue to work.

This timing change is unavoidable: executing user-created Vue effects in a
React render cannot be made safe for aborted concurrent renders.

## Lifecycle callbacks

Rue follows normal passive-effect semantics. Development StrictMode may run
`onMounted` and `onBeforeUnmount` during its setup/cleanup rehearsal.
`onUpdated` skips both initial setup passes and starts with the first later
commit.

## Removed legacy behavior

`batchedUpdates` is not exported. It was already removed from Veact 1.0.0 and
Rue does not restore it. React 18+ provides automatic batching, and Rue does not
import renderer-specific batching APIs.

Vue's `flush` watch option remains unsupported. Watch scheduling is synchronous.
