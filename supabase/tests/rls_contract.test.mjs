import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = new URL('../migrations/202609190002_rls_and_audit.sql', import.meta.url)

test('RLS distinguishes active members, administrators and personal preferences', async () => {
  const sql = await readFile(migration, 'utf8')
  assert.match(sql, /prospects_select_active_member/i)
  assert.match(sql, /prospects_delete_admin/i)
  assert.match(sql, /memberships_admin_manage/i)
  assert.match(sql, /user_preferences_own_rows/i)
  assert.match(sql, /current_app_role\(\) = 'admin'/i)
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i)
})

test('audit records and restore RPC are server-controlled', async () => {
  const sql = await readFile(migration, 'utf8')
  assert.match(sql, /create or replace function public\.record_audit_event\(\)/i)
  assert.match(sql, /create or replace function public\.restore_organization_backup\(payload jsonb\)/i)
  assert.match(sql, /jsonb_typeof\(payload->'prospects'\) <> 'array'/i)
  assert.match(sql, /revoke all on function public\.restore_organization_backup\(jsonb\) from public/i)
  assert.match(sql, /grant execute on function public\.restore_organization_backup\(jsonb\) to authenticated/i)
})
