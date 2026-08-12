# Architecture

Rue is intentionally a small adapter between React and `@vue/reactivity`. Vue
owns dependency tracking and mutable proxies; React owns rendering, scheduling,
and component lifecycle.

## Layers

1. `@vue/reactivity` supplies refs, proxies, computed values, watchers, and
   effect scopes.
2. Rue's raw `watch` and `watchEffect` wrappers select synchronous scheduling.
3. A version store adapts a Vue `ReactiveEffect` to `useSyncExternalStore`.
4. Public hooks own values and bind watchers/scopes to committed React effects.

The runtime may import only `react`, `@vue/reactivity`, and local modules. It
must never branch on a renderer or access DOM/native globals.

## Version store

Each render subscription has four stable operations:

- `subscribe(listener)` starts the Vue effect for the first listener and stops
  it after the last listener leaves;
- `getSnapshot()` returns the cached numeric version;
- `getServerSnapshot()` returns the server version without creating an effect;
- Vue invalidation increments the version before notifying listeners.

Before the first subscription, Rue takes a read-only structural capture of the
watched source. Immediately after arming the Vue effect, it captures the source
again. If a sibling layout effect or another external actor mutated the source
between render and subscribe, Rue advances the version before React's
post-subscribe snapshot check. This closes the initial subscription window
without creating a Vue effect during render. The capture follows the same
deep/shallow boundary as the eventual effect and handles refs, arrays, maps,
sets, and cyclic objects.

The capture reads enumerable data properties and accessors. Two consecutive
pure source reads distinguish stable results from getters that allocate a new
plain container on every read. Allocated containers are compared structurally;
stable roots, refs, and reactive values retain identity. As with React's
`getSnapshot` contract and Vue computed getters, accessors participating in a
reactive source must be pure: they may read reactive dependencies but must not
perform side effects. Reading them is required to distinguish an accessor value
changed between render and subscribe.

Built-in opaque values such as `Date`, `RegExp`, and URL-like objects contribute
their public scalar representation to the capture. Other non-enumerable opaque
objects conservatively notify when a tracked dependency triggers, because Rue
cannot inspect their internal slots without relying on platform or Vue internals.

The snapshot is a primitive and remains `Object.is`-equal between mutations.
Vue's scheduler runs the invalidation job synchronously. React can therefore
observe an external-store change during a transition and retry it as a blocking
update, preventing a stale concurrent commit.

Effects start in `subscribe`, never while rendering. The adapter is memoized for
the current source; a render that is thrown away creates only an unreferenced
plain adapter object and cannot replace committed hook state. StrictMode follows this
sequence safely:

```text
subscribe -> start effect -> unsubscribe -> stop effect
subscribe -> start fresh effect -> ... -> unsubscribe -> stop effect
```

The adapter traverses complete hook sources rather than tracking arbitrary reads
inside React render. This keeps dependency collection independent of render
attempts. Deep subscriptions have traversal cost proportional to the watched
graph; shallow hooks retain Vue's shallow behavior.

`useReactivity` evaluates its getter once per React render and returns that exact
result. The same result seeds render-to-subscribe reconciliation, so Rue cannot
subscribe to one freshly allocated wrapper while returning another. The getter
must be a pure read and may return a new plain wrapper around stable refs or
proxies; it must not create a new reactive store on each invocation. The first
committed effect performs two additional reads to classify a stable root versus
a wrapper factory; both participate in Vue dependency tracking.

The `ReactiveEffect` scheduler compares structural captures before notifying
React, preserving computed-value equality bailouts. Custom and shallow refs opt
into trigger-level invalidation, including module refs returned directly by
`useReactivity`, because `customRef.trigger()` and `triggerRef(shallowRef)` are
intentional notifications even when the getter returns the same value.

## Watch hooks

`useWatch` and `useWatchEffect` return a stable control handle immediately, but
their backing Vue watcher exists only in a passive effect. The control handle
records `pause`, `resume`, or `stop` calls made before setup and forwards them
once a backing watcher exists.

React cleanup stops only the current backing watcher. It does not mark the
logical handle as user-stopped, so StrictMode can install a fresh backing
watcher during its second setup.

`useWatch` stores the latest committed callback separately from the watch
source. A source identity change restarts dependency collection. `useWatchEffect`
keeps one backing watcher and invokes the latest committed effect callback. Its
dependency graph is retracked on each reactive execution, avoiding a second
immediate execution merely because React created a new inline function.

## Effect scopes

The object returned by `useEffectScope` is a stable `EffectScope` facade.
Calling `run` records one setup function without executing it. A passive effect
creates the backing scope, runs setup inside it, applies pending pause state,
and stops it during cleanup.

This preserves the familiar scope controls while maintaining React render
purity. A facade stopped by user code stays stopped; a backing scope stopped by
React cleanup may be recreated by the next StrictMode setup.

## Lifecycle

Lifecycle APIs are passive effects and intentionally follow React semantics.
`onUpdated` uses a separate mount cleanup marker so StrictMode's second initial
effect setup is not misclassified as an update.

## SSR

Server rendering reads the current Vue values and the stable server snapshot.
It creates no Vue watchers and executes no user watch effects. Hydration and
state serialization remain application responsibilities.

Mutable module singletons are unsafe between server requests. Applications
that add SSR should create their stores per request.

## Invariants

Future changes must preserve these rules:

1. No Vue effect, lifecycle callback, or watch effect is created or executed
   during React render; source getters used for snapshot reconciliation are
   pure reads.
2. `getSnapshot` is pure, cached, cheap, and stable between mutations.
3. A mutation increments the version before any React listener runs.
4. Every backing watcher and scope has an idempotent cleanup path.
5. Development StrictMode leaves the same number of active effects as a normal
   mount.
6. No renderer-specific package or batching API enters the runtime bundle.
7. Raw watch APIs remain synchronous and hook watch APIs remain commit-owned.
8. `@vue/reactivity` remains external and must not be bundled into Rue.

Automated tests enforce interrupted transitions, StrictMode cleanup, abandoned
renders, SSR, React Native behavior, Hermes compilation, forbidden imports,
bundle size, and package exports installed in an isolated consumer.
