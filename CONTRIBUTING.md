# Contributing to PerpCity SDK

Thanks for your interest in contributing! This document covers everything you need to get started.

## Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js >= 18
- [pnpm](https://pnpm.io/)

## Getting Started

```bash
git clone https://github.com/StrobeLabs/perpcity-sdk.git
cd perpcity-sdk
pnpm install
```

## Development

```bash
# Build
pnpm build

# Run unit tests
pnpm test:unit

# Run integration tests (requires Base Sepolia RPC)
pnpm test:integration

# Lint
pnpm lint

# Format
pnpm format

# Full CI check (build + test + typecheck + lint)
pnpm ci
```

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Write your code and add tests for new functionality
3. Run `pnpm ci` to verify everything passes
4. Open a PR against `main`

## Code Style

- Follow [Biome](https://biomejs.dev/) formatting and linting rules (enforced by CI)
- Use TypeScript strict mode
- Write tests for new functionality using [Vitest](https://vitest.dev/)

## Reporting Issues

- Use the bug report template for bugs
- Use the feature request template for new features
- Include SDK version, Node/Bun version, and steps to reproduce

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
