# npm ci diagnostic for upstream Pi v0.82.1

This diagnostic was captured from the RePi Integration GitHub Actions workflow on both Ubuntu and Windows.

## Error

```text
npm error code ETARGET
npm error notarget No matching version found for @types/hosted-git-info@9.0.3.
npm error notarget In most cases you or one of your dependencies are requesting
npm error notarget a package version that doesn't exist.
```

## Cause

`packages/coding-agent/package.json` in the v0.82.1 baseline referenced the nonexistent package version:

```json
"@types/hosted-git-info": "9.0.3"
```

The workspace lockfile already referenced the valid version:

```json
"@types/hosted-git-info": "3.0.5"
```

## Resolution

The integration branch pins `@types/hosted-git-info` to `3.0.5`, matching the lockfile and the later upstream correction.

The original downloaded GitHub Actions artifact contained only the short error log above and is not required for development or release.
