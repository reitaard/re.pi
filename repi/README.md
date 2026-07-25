# RePi downstream contract

RePi is maintained as a downstream product layer on top of an exact Pi release tag.

## Version source of truth

No current Pi or RePi version is stored in RePi source code or in `repi/product.json`.

The build derives its identity from Git:

1. Find the nearest first-parent upstream tag matching `v[0-9]*`.
2. Strip the leading `v` to obtain the upstream version.
3. Inspect tags matching `repi-v<upstream>-r<number>`.
4. Use the exact revision when HEAD is release-tagged; otherwise select the next revision.
5. Add commit distance, short SHA, and dirty state for development builds.

Development example:

```text
<upstream>-repi.<next-revision>.dev.<distance>.<short-sha>
```

Release example:

```text
<upstream>-repi.<revision>
```

Release tags use:

```text
repi-v<upstream>-r<revision>
```

RePi must never create or move upstream-style tags such as `v0.x.y`.

## Product identity

Stable identity lives in `repi/product.json`. It contains names, package targets, tag patterns, and compatibility settings only. It must not contain a release number.

## Commands

```bash
npm run repi:version
npm run repi:build-info
```

The coding-agent build also generates `dist/repi-build-info.json` automatically.

## Update safety

The `recode` entrypoint must never replace RePi with `@earendil-works/pi-coding-agent`. Until a tested RePi release channel is available, source-build self-updates fail closed. Extension-only updates remain separate.
