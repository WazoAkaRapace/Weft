# Contributing to Weft

Thank you for your interest in contributing to Weft! This document provides guidelines for contributing to the project.

## Code of Conduct

Be respectful, inclusive, and collaborative. We aim to maintain a welcoming environment for all contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/weft.git`
3. Install dependencies: `pnpm install`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation changes
- `test/` - Test additions or changes
- `chore/` - Maintenance tasks

### Making Changes

1. Write code following the project's style guidelines
2. Test your changes: `pnpm test`
3. Lint your code: `pnpm lint`
4. Build to ensure no type errors: `pnpm build`

### Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(web): add user authentication`
- `fix(server): resolve race condition in data fetching`
- `docs(shared): update type documentation`

## Pull Requests

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] Tests pass locally
- [ ] Linting passes
- [ ] Build succeeds
- [ ] Documentation is updated (if applicable)
- [ ] Commit messages follow conventional commits

### PR Description

Include:
- Summary of changes
- Motivation for the change
- Related issue numbers
- Screenshots (for UI changes)
- Testing steps

### Review Process

1. Automated checks must pass
2. At least one maintainer approval required
3. Address review feedback
4. Squash commits if requested

## Code Style

### TypeScript

- Use TypeScript for all new code
- Prefer explicit type annotations for public APIs
- Avoid `any` - use `unknown` when type is truly unknown
- Use interfaces for object shapes, types for unions

### Naming Conventions

- Files: `kebab-case.ts` or `kebab-case.tsx`
- Components: `PascalCase` (React)
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Types/interfaces: `PascalCase`

### Imports

Order imports:
1. External libraries
2. Internal packages (`@weft/*`)
3. Relative imports
4. Type-only imports last

```typescript
import React from 'react';
import { greet } from '@weft/shared';
import { Button } from './components/Button';
import type { User } from './types';
```

## Testing

- Write unit tests for utilities and pure functions
- Test components for critical user flows
- Aim for high test coverage on shared code
- Use descriptive test names

```typescript
describe('functionName', () => {
  it('should do X when Y', () => {
    // Arrange
    const input = ...;

    // Act
    const result = functionName(input);

    // Assert
    expect(result).toEqual(expected);
  });
});
```

## Documentation

- Update README for user-facing changes
- Update ARCHITECTURE.md for structural changes
- Add JSDoc comments for public APIs
- Keep code comments minimal - code should be self-documenting

## Questions?

- Open a discussion for questions
- Use issues for bugs and feature requests
- Join our community chat (link to be added)

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
