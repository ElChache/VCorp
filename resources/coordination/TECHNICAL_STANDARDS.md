# Technical Standards

**Document Version**: 1.0.0  
**Last Updated**: 2025-01-06  
**Maintained By**: Lead Developer (ld_claude_001_a4b7)

## Code Quality Standards

### TypeScript Configuration
- **Strict Mode**: REQUIRED - All TypeScript files must compile with strict mode enabled
- **No Implicit Any**: Forbidden - All variables must have explicit types
- **Unused Variables**: Error - No unused variables or parameters allowed (prefix with `_` if intentionally unused)
- **Compiler Target**: ES2020 minimum for modern JavaScript features
- **Module Resolution**: Bundler mode for SvelteKit compatibility

### Linting & Formatting
- **ESLint**: Required for all TypeScript and Svelte files
- **Prettier**: Enforced formatting with tab indentation
- **Pre-commit Hooks**: Run linting and formatting checks before commits
- **Console Logs**: Warning - Only console.warn and console.error allowed in production code

### Testing Requirements
- **Unit Tests**: Minimum 80% code coverage for business logic
- **Integration Tests**: Required for all API endpoints
- **E2E Tests**: Critical user flows must have Playwright tests
- **Visual Testing**: AI-powered screenshot verification for UI changes
- **Test Naming**: Descriptive test names using `describe` and `it` blocks

### AI Visual Testing Integration
```javascript
// Required screenshot capture for UI verification
await page.screenshot({ 
  path: `/tmp/screenshot_${agentId}_${Date.now()}.png`,
  fullPage: true 
});
```

### Documentation Standards
- **JSDoc Comments**: Required for all public functions and classes
- **README Files**: Each major module must have documentation
- **API Documentation**: OpenAPI/Swagger specs for all endpoints
- **Change Logs**: Document breaking changes in CHANGELOG.md

## Development Workflow

### Git Branching Strategy
- **Main Branch**: Protected, requires PR approval
- **Feature Branches**: `feature/task-id-description`
- **Fix Branches**: `fix/issue-id-description`
- **Agent Branches**: `agent/{agent_id}/feature-name` for isolated development

### Commit Conventions
```
[ROLE] Task: Brief description

- Specific change 1
- Specific change 2

Task: {task_id}
Agent: {agent_id}
```

### Code Review Process
1. **Self Review**: Developer reviews own code before PR
2. **Automated Checks**: CI runs tests, linting, type checking
3. **Lead Developer Review**: Manual review for functionality and standards
4. **Merge Requirements**: All checks pass, approved review, no conflicts

### CI/CD Requirements
- **Type Checking**: `pnpm check` must pass
- **Linting**: `pnpm lint` must pass without warnings
- **Tests**: All test suites must pass
- **Build**: `pnpm build` must complete successfully
- **Security**: No secrets or credentials in code

## SvelteKit Best Practices

### Component Organization
```
src/lib/components/
├── common/        # Shared components
├── forms/         # Form components
├── layouts/       # Layout components
└── features/      # Feature-specific components
```

### Naming Conventions
- **Components**: PascalCase (e.g., `UserProfile.svelte`)
- **Utilities**: camelCase (e.g., `formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- **Types/Interfaces**: PascalCase with descriptive names

### State Management
- **Stores**: Use Svelte stores for global state
- **Context**: Use context API for component tree state
- **Props**: Prefer props for parent-child communication
- **Events**: Use custom events for child-parent communication

### Route Organization
```
src/routes/
├── (auth)/          # Grouped routes with authentication
├── (public)/        # Public routes
├── api/            # API endpoints
└── (app)/          # Main application routes
```

### Performance Guidelines
- **Lazy Loading**: Use dynamic imports for large components
- **Image Optimization**: Use appropriate formats and sizes
- **Bundle Size**: Monitor and optimize bundle size
- **Server-Side Rendering**: Default for better SEO and performance

## Database Standards

### Query Optimization
- **Indexing**: Create indexes for frequently queried columns
- **N+1 Prevention**: Use joins or batch queries
- **Connection Pooling**: Reuse database connections
- **Prepared Statements**: Use parameterized queries for security

### Transaction Management
```typescript
// Use transaction wrapper for atomic operations
await db.transaction(async (client) => {
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
});
```

### Migration Process
- **Version Control**: All schema changes in migration files
- **Rollback Support**: Each migration must have down() method
- **Testing**: Test migrations on development database first
- **Documentation**: Comment complex schema changes

### Error Handling
```typescript
try {
  const result = await db.query(sql, params);
  return result;
} catch (error) {
  logger.error('Database error:', error);
  throw new DatabaseError('Operation failed', { cause: error });
}
```

## API Standards

### RESTful Principles
- **Resources**: Use nouns for endpoints (e.g., `/api/monitors`)
- **HTTP Methods**: GET (read), POST (create), PUT (update), DELETE (delete)
- **Status Codes**: Use appropriate HTTP status codes
- **Versioning**: Include version in URL (e.g., `/api/v1/`)

### Request/Response Format
```typescript
// Standard response structure
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}
```

### Authentication & Security
- **JWT Tokens**: Use for stateless authentication
- **Rate Limiting**: Implement per-user and per-IP limits
- **Input Validation**: Use Zod schemas for all inputs
- **CORS**: Configure appropriately for production
- **HTTPS**: Required in production environments

### Error Handling
```typescript
// Consistent error responses
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}
```

## Security Standards

### Data Protection
- **Encryption**: Sensitive data encrypted at rest and in transit
- **Password Hashing**: Use bcrypt with appropriate salt rounds
- **SQL Injection**: Use parameterized queries only
- **XSS Prevention**: Sanitize user inputs and outputs

### Environment Variables
- **Secret Management**: Never commit secrets to repository
- **Configuration**: Use `.env` files for local development
- **Production**: Use secure secret management service
- **Validation**: Validate all environment variables on startup

### Authentication Flow
1. User submits credentials
2. Verify against database
3. Generate JWT token
4. Return token with secure httpOnly cookie
5. Validate token on each request

## Monitoring & Logging

### Logging Standards
```typescript
// Structured logging format
logger.info('User action', {
  userId: user.id,
  action: 'monitor_created',
  monitorId: monitor.id,
  timestamp: new Date().toISOString()
});
```

### Error Tracking
- **Capture Errors**: Log all unhandled errors
- **Context**: Include request context in error logs
- **Alerting**: Set up alerts for critical errors
- **Metrics**: Track error rates and response times

### Performance Monitoring
- **Response Times**: Monitor API response times
- **Database Queries**: Track slow queries
- **Memory Usage**: Monitor application memory
- **CPU Usage**: Track processing load

## Team Collaboration

### Communication
- **Task Updates**: Use coordination TASKS files
- **Blockers**: Report immediately in BLOCKERS.md
- **Questions**: Post in FORUM.md with proper formatting
- **PRs**: Provide clear descriptions and testing instructions

### Knowledge Sharing
- **Documentation**: Keep docs up to date
- **Code Comments**: Explain complex logic
- **Pair Programming**: Share knowledge through collaboration
- **Tech Talks**: Regular knowledge sharing sessions

### Continuous Improvement
- **Retrospectives**: Regular team retrospectives
- **Code Reviews**: Learn from review feedback
- **Best Practices**: Update standards based on learnings
- **Tool Updates**: Keep dependencies updated

## Enforcement

These standards are enforced through:
1. Automated CI/CD checks
2. Lead Developer code reviews
3. Pre-commit hooks
4. Regular audits

Non-compliance will result in:
1. PR rejection
2. Task marked as "review blocked"
3. Required fixes before merge

## Updates

This document is living and will be updated based on:
- Team feedback
- Industry best practices
- Project requirements
- Technical discoveries

Last reviewed by: Lead Developer
Next review date: 2025-02-06