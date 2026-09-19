import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = new URL('../migrations/202609190001_team_schema.sql', import.meta.url)

test('the team schema defines every tenant table with RLS', async () => {
  const sql = await readFile(migration, 'utf8')
  const tables = ['organizations', 'memberships', 'prospects', 'activities', 'status_history', 'organization_settings', 'user_preferences', 'audit_log']
  for (const table of tables) {
    assert.match(sql, new RegExp(`create table public\\.${table}\\b`, 'i'), `${table} is missing`)
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), `${table} has no RLS`)
  }
  assert.match(sql, /create type public\.app_role as enum \('admin', 'collaborator'\)/i)
  assert.match(sql, /unique \(organization_id, user_id\)/i)
  assert.match(sql, /revoke all on all tables in schema public from anon/i)
})

test('identity fields are derived server-side and immutable', async () => {
  const sql = await readFile(migration, 'utf8')
  assert.match(sql, /create or replace function public\.set_record_identity\(\)/i)
  assert.match(sql, /new\.organization_id := public\.current_organization_id\(\)/i)
  assert.match(sql, /organization_id is immutable/i)
  assert.match(sql, /created_by is immutable/i)
})
