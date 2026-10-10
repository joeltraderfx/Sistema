-- Rode isso uma vez no Supabase: SQL Editor -> New query -> cole e execute (Run)

create table if not exists licenses (
  id              bigserial primary key,
  license_key     text unique not null,
  product_id      text,
  plan_days       integer not null,
  client_email    text not null,
  client_name     text,
  status          text not null default 'active',   -- active | canceled | expired
  expires_at      timestamptz not null,
  bound_account   text,                              -- numero da conta MT5 vinculada (preenchido na 1a ativacao)
  bound_broker    text,                              -- corretora vinculada
  bound_at        timestamptz,
  greenn_sale_id  text,
  greenn_contract_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_licenses_key on licenses (license_key);
create index if not exists idx_licenses_contract on licenses (greenn_contract_id);
create index if not exists idx_licenses_email on licenses (client_email);
