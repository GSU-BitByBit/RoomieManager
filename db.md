## Table `_prisma_migrations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `varchar` | Primary |
| `checksum` | `varchar` |  |
| `finished_at` | `timestamptz` |  Nullable |
| `migration_name` | `varchar` |  |
| `logs` | `text` |  Nullable |
| `rolled_back_at` | `timestamptz` |  Nullable |
| `started_at` | `timestamptz` |  |
| `applied_steps_count` | `int4` |  |

## Table `bill_splits`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `bill_id` | `text` |  |
| `group_id` | `text` |  |
| `user_id` | `text` |  |
| `amount` | `numeric` |  |
| `created_at` | `timestamp` |  |

## Table `bills`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `group_id` | `text` |  |
| `title` | `varchar` |  |
| `description` | `text` |  Nullable |
| `total_amount` | `numeric` |  |
| `currency` | `varchar` |  |
| `paid_by_user_id` | `text` |  |
| `split_method` | `BillSplitMethod` |  |
| `created_by` | `text` |  |
| `incurred_at` | `timestamp` |  |
| `due_date` | `timestamp` |  Nullable |
| `created_at` | `timestamp` |  |
| `updated_at` | `timestamp` |  |

## Table `chore_activity`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `chore_id` | `text` |  |
| `group_id` | `text` |  |
| `actor_user_id` | `text` |  |
| `type` | `ChoreActivityType` |  |
| `details` | `jsonb` |  Nullable |
| `created_at` | `timestamp` |  |

## Table `chore_template_participants`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `template_id` | `text` |  |
| `group_id` | `text` |  |
| `user_id` | `text` |  |
| `sort_order` | `int4` |  |
| `created_at` | `timestamp` |  |
| `updated_at` | `timestamp` |  |

## Table `chore_templates`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `group_id` | `text` |  |
| `title` | `varchar` |  |
| `description` | `text` |  Nullable |
| `status` | `ChoreTemplateStatus` |  |
| `starts_on` | `date` |  |
| `ends_on` | `date` |  Nullable |
| `assigned_to_user_id` | `text` |  Nullable |
| `created_by` | `text` |  |
| `updated_by` | `text` |  Nullable |
| `generated_through_on` | `date` |  Nullable |
| `created_at` | `timestamp` |  |
| `updated_at` | `timestamp` |  |
| `assignment_strategy` | `ChoreTemplateAssignmentStrategy` |  |
| `repeat_every_days` | `int4` |  |

## Table `chores`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `group_id` | `text` |  |
| `title` | `varchar` |  |
| `description` | `text` |  Nullable |
| `status` | `ChoreStatus` |  |
| `due_date` | `date` |  |
| `assigned_to_user_id` | `text` |  |
| `created_by` | `text` |  |
| `completed_at` | `timestamp` |  Nullable |
| `created_at` | `timestamp` |  |
| `updated_at` | `timestamp` |  |
| `template_id` | `text` |  Nullable |
| `slot_dedupe_key` | `varchar` |  Nullable |
| `completed_by_user_id` | `text` |  Nullable |
| `occurrence_index` | `int4` |  Nullable |

## Table `contract_versions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `group_id` | `text` |  |
| `contract_id` | `text` |  |
| `version` | `int4` |  |
| `content` | `text` |  |
| `published_by` | `text` |  |
| `created_at` | `timestamp` |  |

## Table `contracts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `group_id` | `text` |  |
| `draft_content` | `text` |  |
| `published_version` | `int4` |  Nullable |
| `updated_by` | `text` |  Nullable |
| `created_at` | `timestamp` |  |
| `updated_at` | `timestamp` |  |

## Table `group_audit_logs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `group_id` | `text` |  |
| `actor_user_id` | `text` |  |
| `target_user_id` | `text` |  Nullable |
| `action` | `varchar` |  |
| `details` | `jsonb` |  Nullable |
| `created_at` | `timestamp` |  |

## Table `group_members`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `group_id` | `text` |  |
| `user_id` | `text` |  |
| `role` | `GroupMemberRole` |  |
| `status` | `GroupMemberStatus` |  |
| `joined_at` | `timestamp` |  |
| `created_at` | `timestamp` |  |
| `updated_at` | `timestamp` |  |
| `display_name` | `varchar` |  Nullable |

## Table `groups`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `varchar` |  |
| `created_by` | `text` |  |
| `created_at` | `timestamp` |  |
| `updated_at` | `timestamp` |  |

## Table `join_codes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `group_id` | `text` |  |
| `code` | `varchar` |  |
| `created_by` | `text` |  |
| `created_at` | `timestamp` |  |
| `updated_at` | `timestamp` |  |
| `expires_at` | `timestamp` |  Nullable |

## Table `ledger_entries`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `group_id` | `text` |  |
| `bill_id` | `text` |  Nullable |
| `bill_split_id` | `text` |  Nullable |
| `payment_id` | `text` |  Nullable |
| `entry_type` | `LedgerEntryType` |  |
| `from_user_id` | `text` |  |
| `to_user_id` | `text` |  |
| `amount` | `numeric` |  |
| `currency` | `varchar` |  |
| `occurred_at` | `timestamp` |  |
| `created_at` | `timestamp` |  |

## Table `payments`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `group_id` | `text` |  |
| `bill_id` | `text` |  Nullable |
| `payer_user_id` | `text` |  |
| `payee_user_id` | `text` |  |
| `amount` | `numeric` |  |
| `currency` | `varchar` |  |
| `note` | `text` |  Nullable |
| `idempotency_key` | `varchar` |  Nullable |
| `paid_at` | `timestamp` |  |
| `created_by` | `text` |  |
| `created_at` | `timestamp` |  |
| `updated_at` | `timestamp` |  |

## Table `system_settings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `key` | `varchar` | Primary |
| `value` | `jsonb` |  |
| `updatedAt` | `timestamp` |  |

