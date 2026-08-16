# Project1337 Working Agreements

## Automatic beta releases

The user granted standing authorization on 2026-08-16 for routine beta releases of explicitly requested Project1337 changes.

- After completing a user-requested change on `beta`, run the relevant tests and a production build. Fix failures before publishing.
- When verification succeeds, commit only the task-scoped files, publish them to `gallardo1337/project1337` on branch `beta`, and wait for the Vercel beta preview to reach `READY`. Do not request a separate routine deployment confirmation.
- Before publishing, fetch `origin/beta` and require the expected remote commit to be the direct parent or an ancestor of the verified local work. Stop on unexpected divergence or unrelated changes.
- Never force-push and never overwrite unrelated work.
- If direct Git authentication is unavailable, the connected GitHub app may recreate the verified local tree as a GitHub-native commit and update `beta` without force. Verify that the complete tree is byte-identical before and after publishing, then align the local `beta` ref with the remote commit.
- Updating `main`, promoting to Production, destructive operations, schema migrations, secret changes, or broader external side effects always require separate explicit user authorization.
- Stop and report instead of publishing when tests or the build fail, the worktree contains unrelated changes, sensitive data may be included, the remote branch changed unexpectedly, or a platform policy requires user confirmation.
