## File size enforcement

Before creating or editing any file, check its current line count:

```bash
wc -l src/path/to/file.ts
```

| File type | Soft limit | Hard limit | Action at soft limit |
|-----------|-----------|------------|---------------------|
| React components (`*.tsx`) | 150 lines | 200 lines | Extract hooks and sub-components |
| API route handlers (`route.ts`) | 150 lines | 200 lines | Extract to service layer |
| Service files | 200 lines | 300 lines | Split by sub-domain |
| Repository files | 150 lines | 200 lines | Split by query group |
| Utility/lib files | 150 lines | 200 lines | Split by function group |
| Type files | 200 lines | 300 lines | Split by domain entity |
| Test files | 300 lines | 400 lines | Split by test group |
| Config files | No limit | No limit | — |

When a file hits its soft limit, **refactor before adding more code**. Use the `monolith-breaker` agent if the file is already over its hard limit.

Never create a new file over 150 lines. If your implementation would exceed this, plan the split before writing any code.

## Quick check command
```bash
# Find all files over 150 lines in src/
find src -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | awk '$1 > 150' | head -20
```
