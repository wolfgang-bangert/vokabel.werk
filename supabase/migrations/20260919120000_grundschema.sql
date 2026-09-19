-- vokabel.werk: Grundschema
-- Kinder erfassen eigene Vokabeln (Englisch/Latein). Passt eine Vokabel zur zentralen
-- Quelle, werden Eselsbrücken sichtbar - aber nur, wenn das Kind sie selbst erfasst hat.

create extension if not exists pg_trgm;

create or replace function norm(t text) returns text
language sql immutable as $$ select lower(trim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g'))) $$;

-- Zentrale Quelle (Schulbücher/API). Kinder haben keinen direkten Zugriff.
create table zentrale_vokabel (
  id uuid primary key default gen_random_uuid(),
  sprache text not null check (sprache in ('en', 'la')),
  wort text not null,
  deutsch text not null,
  quelle text,
  created_at timestamptz not null default now()
);
create unique index zentrale_vokabel_eindeutig
  on zentrale_vokabel (sprache, norm(wort), norm(deutsch));
create index zentrale_vokabel_wort_trgm on zentrale_vokabel using gin (norm(wort) gin_trgm_ops);

create table eselsbruecke (
  id uuid primary key default gen_random_uuid(),
  zentral_id uuid not null references zentrale_vokabel (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
create index on eselsbruecke (zentral_id);

-- Brücke zwischen einer englischen und einer lateinischen Vokabel
create table sprachbruecke (
  id uuid primary key default gen_random_uuid(),
  en_id uuid not null references zentrale_vokabel (id) on delete cascade,
  la_id uuid not null references zentrale_vokabel (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  unique (en_id, la_id)
);

-- Eigene Vokabeln je Kind (Fach 6 = gelernt)
create table vokabel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sprache text not null check (sprache in ('en', 'la')),
  wort text not null,
  deutsch text not null,
  zentral_id uuid references zentrale_vokabel (id) on delete set null,
  fach smallint not null default 1 check (fach between 1 and 6),
  faellig_am timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on vokabel (user_id, fach, faellig_am);
create index on vokabel (zentral_id);

-- Wiederholungsabstand je Kind und Fach (1-5), in Stunden. Ohne Zeile gilt der Standard.
create table lernintervall (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fach smallint not null check (fach between 1 and 5),
  stunden integer not null check (stunden > 0),
  primary key (user_id, fach)
);

create function intervall_stunden(p_user uuid, p_fach smallint) returns integer
language sql stable as $$
  select coalesce(
    (select stunden from lernintervall where user_id = p_user and fach = p_fach),
    (array[24, 72, 168, 336, 720])[p_fach]
  )
$$;

-- Automatischer Treffer bei exakter Übereinstimmung (Wort + deutsche Bedeutung)
create function vokabel_zuordnen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select z.id into new.zentral_id
  from zentrale_vokabel z
  where z.sprache = new.sprache
    and norm(z.wort) = norm(new.wort)
    and norm(z.deutsch) = norm(new.deutsch)
  limit 1;
  return new;
end $$;
create trigger vokabel_zuordnen before insert or update of wort, deutsch, sprache
  on vokabel for each row execute function vokabel_zuordnen();

-- Vorschläge bei Tippfehlern (ähnliche Wörter aus der zentralen Quelle)
create function vokabel_vorschlaege(p_sprache text, p_wort text)
returns table (wort text, deutsch text, aehnlichkeit real)
language sql stable security definer set search_path = public as $$
  select z.wort, z.deutsch, similarity(norm(z.wort), norm(p_wort))
  from zentrale_vokabel z
  where z.sprache = p_sprache and norm(z.wort) % norm(p_wort)
  order by 3 desc
  limit 5
$$;
revoke all on function vokabel_vorschlaege from public;
grant execute on function vokabel_vorschlaege to authenticated;

-- RLS
alter table zentrale_vokabel enable row level security;  -- keine Policy = kein Zugriff
alter table eselsbruecke enable row level security;
alter table sprachbruecke enable row level security;
alter table vokabel enable row level security;
alter table lernintervall enable row level security;

create policy vokabel_eigene on vokabel for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy lernintervall_eigene on lernintervall for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Eselsbrücke nur sichtbar, wenn das Kind die Vokabel selbst erfasst hat
create policy eselsbruecke_lesen on eselsbruecke for select to authenticated
  using (exists (select 1 from vokabel v
                 where v.zentral_id = eselsbruecke.zentral_id and v.user_id = auth.uid()));

-- Sprachbrücke nur, wenn das Kind beide Vokabeln erfasst hat
create policy sprachbruecke_lesen on sprachbruecke for select to authenticated
  using (exists (select 1 from vokabel v
                 where v.zentral_id = sprachbruecke.en_id and v.user_id = auth.uid())
     and exists (select 1 from vokabel v
                 where v.zentral_id = sprachbruecke.la_id and v.user_id = auth.uid()));
