-- Kapitel als eigene Einheit: erst anlegen, dann Vokabeln hineinerfassen oder
-- gezielt lernen. Ersetzt das bisherige freie Textfeld auf vokabel.kapitel
-- (bleibt zur Sicherheit erhalten, wird aber nicht mehr befüllt).

create table kapitel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sprache text not null check (sprache in ('en', 'la')),
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (user_id, sprache, name)
);
alter table kapitel enable row level security;
create policy kapitel_eigene on kapitel for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table vokabel add column if not exists kapitel_id uuid references kapitel (id) on delete set null;
create index if not exists vokabel_kapitel_id_idx on vokabel (user_id, kapitel_id);

-- Bestehende freie Kapitel-Texte in echte Kapitel überführen
insert into kapitel (user_id, sprache, name)
select distinct user_id, sprache, kapitel from vokabel
where kapitel is not null
on conflict do nothing;

update vokabel v set kapitel_id = k.id
from kapitel k
where v.kapitel_id is null and v.kapitel is not null
  and k.user_id = v.user_id and k.sprache = v.sprache and k.name = v.kapitel;
