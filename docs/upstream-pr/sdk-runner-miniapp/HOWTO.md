# HOWTO — submit the MiniappRunner PR to `aboutcircles/sdk`

The four files in this directory (`miniapp-runner.ts`, `index-diff.md`, `README-diff.md`, `PR_BODY.md`) make the PR turnkey. Walk through these steps to land it.

## 1. Fork + clone

```bash
gh repo fork aboutcircles/sdk --clone=true --remote=true
cd sdk
git checkout -b feat/runner-miniapp
```

## 2. Drop the runner in place

```bash
cp <path-to-thekitty>/docs/upstream-pr/sdk-runner-miniapp/miniapp-runner.ts \
   packages/runner/src/miniapp-runner.ts
```

## 3. Apply the index + README diffs

Open `packages/runner/src/index.ts` and add the two `MiniappRunner` export lines from [`index-diff.md`](./index-diff.md) below the existing `SafeBrowserRunner` block.

Open `packages/runner/README.md` and:
- Patch the overview paragraph (one sentence add).
- Append the `### MiniappRunner` section between `### SafeContractRunner` and `## Features`.
- Add the `### MiniappRunner` API block under the API section.

Both changes are sketched in [`README-diff.md`](./README-diff.md).

## 4. Sanity-check the build

```bash
bun install
cd packages/runner
bun run build
```

`dist/miniapp-runner.js` and `dist/miniapp-runner.d.ts` should appear, and `dist/index.d.ts` should re-export the new symbols.

## 5. Commit + push

```bash
cd <repo root>
git add packages/runner/src/miniapp-runner.ts \
        packages/runner/src/index.ts \
        packages/runner/README.md
git commit -m "feat(runner): add MiniappRunner for the Circles miniapps host"
git push origin feat/runner-miniapp
```

## 6. Open the PR

```bash
gh pr create \
  --repo aboutcircles/sdk \
  --base main \
  --head <your-username>:feat/runner-miniapp \
  --title "feat(runner): add MiniappRunner for the Circles miniapps host" \
  --body-file <path-to-thekitty>/docs/upstream-pr/sdk-runner-miniapp/PR_BODY.md
```

## 7. After it lands

- Once merged + published, bump `@aboutcircles/sdk-runner` in `apps/web/package.json` of this repo to the version that ships MiniappRunner, then delete `apps/web/src/lib/miniapp-runner.ts` and update the import in `WalletProvider.tsx`:
  ```diff
  -import { MiniappRunner } from '@/lib/miniapp-runner';
  +import { MiniappRunner } from '@aboutcircles/sdk-runner';
  ```
  Adjust the constructor call to pass `(publicClient, sendTransactions, address)` — the upstream signature reorders the args compared to our in-tree version.

- Mention the merged PR in the cycle 4 Garage progress note: *"MiniappRunner shipped upstream as part of `@aboutcircles/sdk-runner` vX.Y.Z."* That's a strong "deep Circles contributor" signal.

## Notes

- The upstream repo is a monorepo with `packages/runner` (not `packages/sdk-runner`). The package name `@aboutcircles/sdk-runner` is set in that package's `package.json`.
- The local copy of the runner in `apps/web/src/lib/miniapp-runner.ts` is the V1 in-tree version. The upstream version in this directory drops the in-tree imports and follows the upstream code conventions (RunnerError, arrow-function class fields, JSDoc with @example blocks, static `create()` factory, viem `TransactionReceipt` return).
- If the maintainers prefer a hard dep on `@aboutcircles/miniapp-sdk` (so they can import `sendTransactions` directly), the runner can be simplified — they'll flag it during review.
