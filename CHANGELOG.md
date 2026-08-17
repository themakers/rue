# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 - 2026-08-12

### Added

- Forked Veact as `@themakers/rue` with preserved MIT attribution.
- Added `useSyncExternalStore` version subscriptions and server snapshots.
- Added StrictMode, concurrent rendering, SSR, React Native, and Hermes tests.
- Added shared-store examples for Vite, Expo, and Expo with React Strict DOM.
- Added platform import, package export, bundle size, and coverage gates.
- Added interrupted-transition tearing coverage and a broader React Native
  behavioral matrix.
- Added component-owned `useReactive` TODO examples for every renderer.
- Added `useTemplateRef` for one-variable Vue-style DOM refs in JSX.

### Changed

- React 18 is now the minimum supported version.
- `@vue/reactivity` is a peer dependency.
- Hook watchers and effect scopes are created after commit and cleaned up with
  React effects.
- The package now ships platform-neutral ESM and CJS bundles.
- Render subscriptions use commit-owned `ReactiveEffect` instances, including
  explicit same-value `customRef` triggers.
- `useReactivity` evaluates and returns one getter result per render without
  mutating committed adapter state from discarded renders.
- CI covers React 18.3.1, the latest React 19 web release, and Expo's pinned
  React Native renderer matrix.
- Git dependencies now build the ignored `dist` output through `prepare`, while
  package tarballs build and validate it through `prepack`.

### Removed

- Removed `react-dom` as a peer dependency.
- Removed the automatic tag/release scripts inherited from Veact.

## Veact history

### v1.0.0 (2024-09-05)

#### Added

- Export `watch` as `baseWatch` from `@vue/reactivity`
- Introduced `useEffectScope` API.
- Introduced `useCustomRef` API.
- Introduced `useReadonly` and `useShallowReadonly` APIs.
- Added JSDoc comments for all functions.
- Added API documentation to `README.md`.
- Added development mode.

#### Changed

- Refactored `watch`, `useWatch`, `watchEffect`, and `useWatchEffect` APIs.
- Replaced `yarn` with `pnpm`.
- Replaced `jest` with `vitest`.
- Replaced `libundler` with `vite` as the bundler.
- Upgraded `React` and `react-dom` peerDependencies versions.
- Upgraded `@vue/reactivity` dependency to `>=3.5`.
- Upgraded ESLint to v9.
- Updated unit test scripts.

#### Removed

- Removed `batchedUpdates` API.

### v1.0.0-beta.2 (2024-08-15)

No changes, just synced with `@vue/reactivity` [v3.5.0-beta.2](https://github.com/vuejs/core/blob/main/CHANGELOG.md#350-beta2-2024-08-15).

### v1.0.0-beta.1 (2024-08-12)

#### Added

- Introduced `useEffectScope` API.
- Introduced `useCustomRef` API.
- Introduced `useReadonly` and `useShallowReadonly` APIs.
- Added JSDoc comments for all functions.
- Added API documentation to `README.md`.
- Added development mode.

#### Changed

- Refactored `watch`, `useWatch`, `watchEffect`, and `useWatchEffect` APIs.
- Replaced `yarn` with `pnpm`.
- Replaced `jest` with `vitest`.
- Replaced `libundler` with `vite` as the bundler.
- Upgraded `React` and `react-dom` peerDependencies versions.
- Upgraded ESLint to v9.
- Updated unit test scripts.

#### Removed

- Removed `batchedUpdates` API.

#### Fixed

- Fixed Issue [#6](https://github.com/veactjs/veact/issues/6).
- Fixed Issue [#4](https://github.com/veactjs/veact/issues/4).

### v0.1.4 (2022-01-17)

- upgrade reactivity deps
- upgrade `libundler`

### v0.1.3 (2021-08-02)

- upgrade reactivity deps
- update document links with reactivity

### v0.1.2 (2021-07-27)

- fix `peerDependencies` React version

### v0.1.0 (2021-07-27)

- fix types

### v0.1.0 (2021-07-26)

- lifecycle API
- hooks API
- watch API
- support SSR
