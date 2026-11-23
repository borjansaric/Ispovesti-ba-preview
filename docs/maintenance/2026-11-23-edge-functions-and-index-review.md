# Edge Functions and index review — 2026-11-23

> **Read-only inventory and retirement gate.** No Edge Function was disabled, redeployed, deleted, or modified. No index was created or dropped.

## Registered Edge Functions

The audit found eight functions registered as ACTIVE. ACTIVE describes deployment state; it does not guarantee that the endpoint is operational or that it serves current clients.

| Function | Version | verify_jwt | Read-only finding |
|---|---:|---:|---|
| `community-live-api` | 5 | false | Current live community gateway; archived source matches deployed source |
| `community-test-api` | 17 | false | Current test community gateway; source already present in preview repository |
| `chat-live-api` | 1 | false | Current live chat gateway; archived source matches deployed source |
| `chat-test-api` | 6 | false | Current test chat gateway; archived source matches deployed source |
| `admin-recovery-live-api` | 1 | false | Recovery gateway; archived source matches deployed source |
| `submit-content` | 3 | true | Retired stub; returns HTTP 410 for non-OPTIONS requests |
| `vote-content9` | 3 | true | Retired stub; returns HTTP 410 for non-OPTIONS requests |
| `private-user-lists` | 3 | true | Deployed; source archived; no direct reference found in the current root client during the static review |

The absence of a reference in the current root client is not proof that no older client, external integration, saved page, or direct caller still uses an endpoint. Do not disable any function solely because it appears unused in the current frontend.

## Advisor findings

The read-only advisor review reported:

- **19** unindexed foreign keys
- **15** indexes classified as unused
- **69** tables without primary keys; many appear to be archive or snapshot tables
- A security warning that leaked-password protection is disabled
- Anonymous-access warnings related to chat messages/cron/realtime that did not align with the direct `pg_policies` inspection of the chat message tables. This discrepancy remains unresolved and should be rechecked before remediation.

The direct grants inspection found no direct browser-role table privileges on the relevant application schemas. RLS/no-policy INFO findings alone should not be interpreted as proof of public table access.

## Safe retirement sequence

### Edge Functions

1. Inventory every frontend, archived client, workflow, external integration, and direct caller.
2. Review invocation logs over a representative period and identify any calls to candidate endpoints.
3. Confirm the replacement endpoint and error behavior for older clients.
4. Prepare a rollback plan and an explicit endpoint-by-endpoint approval.
5. Only then consider disabling a function. Do not delete its archived source.

### Indexes and primary keys

1. Reconcile advisor output with actual schema objects and workload/query statistics.
2. Inspect query plans and write/read patterns before proposing any index change.
3. Separate operational tables from archive/snapshot tables before considering primary-key work.
4. Propose changes individually with expected benefit, lock/availability impact, and rollback.
5. Do not bulk-drop indexes based only on an “unused” advisor label.

## Status

- Function inventory and source matching: **read-only inspected**
- Retired endpoint behavior: **source inspected; no runtime smoke test performed in this review**
- Index/PK findings: **advisor output recorded; no remediation applied**
- Database and Edge Functions: **untouched**
