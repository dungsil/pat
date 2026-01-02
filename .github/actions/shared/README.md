# @pat-actions/shared

Shared utilities for GitHub Actions in this repository.

## Purpose

This package eliminates code duplication by providing common utilities used across multiple GitHub Actions.

## Usage

In your action's `package.json`:

```json
{
  "dependencies": {
    "@pat-actions/shared": "file:../shared"
  }
}
```

In your action's code:

```javascript
const { githubApiRetry } = require('@pat-actions/shared');
```

## Contents

- `github-retry.cjs`: GitHub API retry logic with exponential backoff for handling rate limits (403, 429) and server errors (5xx)

## Maintenance

This is a local npm package using the `file:` protocol. Any changes to this package will automatically be picked up when actions run `npm ci` during their composite action workflow.
