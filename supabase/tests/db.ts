// A real PostgreSQL (PGlite, in-process) with the small part of Supabase our migration relies on: the roles,
// auth.users / auth.uid(), and storage.objects / storage.foldername(). Lets the access rules (RLS, grants,
// functions) be tested anywhere, without Docker. The CI also runs the full Supabase stack (see .github/workflows/ci.yml).
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

const SHIM = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text unique, email_confirmed_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text not null, owner uuid default auth.uid(), unique (bucket_id, name));
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant execute on function storage.foldername(text) to anon, authenticated;
`;

export async function freshDb() {
  const db = new PGlite();
  await db.exec(SHIM);
  // Every migration except the scheduling one (pg_cron and pg_net do not exist in PGlite).
  const dir = new URL("../migrations/", import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql") && !f.includes("cron")).sort())
    await db.exec(readFileSync(new URL(f, dir), "utf8").replace(/^create extension.*$/gm, ""));
  return db;
}

export type Db = Awaited<ReturnType<typeof freshDb>>;

// Runs SQL as a signed-in user (role authenticated + JWT subject), like a request through the Supabase API.
export async function as<T = Record<string, unknown>>(db: Db, uid: string | null, query: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.exec(uid ? `set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true);` : "set local role anon;");
    return (await tx.query<T>(query, params)).rows;
  });
}

// Expects a statement to be refused (policy, grant or rule raised by a function).
export async function refused(p: Promise<unknown>, pattern?: RegExp) {
  try {
    await p;
  } catch (e) {
    if (pattern && !pattern.test((e as Error).message)) throw new Error(`Refused for another reason: ${(e as Error).message}`);
    return (e as Error).message;
  }
  throw new Error("Expected the database to refuse, but it accepted.");
}

export async function user(db: Db, email: string) {
  const id = crypto.randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  return id;
}
