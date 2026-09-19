-- Elternzugang: Rollen, Verknüpfung per Code, Lernkontrolle, Tagesziel und Zeitkonto.
-- Verknüpfung und Buchungen laufen nur über Funktionen (security definer), nie direkt.

create function heute_berlin() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Europe/Berlin')::date $$;

create function tagesbeginn_berlin() returns timestamptz
language sql stable set search_path = '' as $$
  select ((now() at time zone 'Europe/Berlin')::date)::timestamp at time zone 'Europe/Berlin'
$$;

-- Profil: Rolle und Anzeigename (aus den Angaben bei der Registrierung)
create table profil (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rolle text not null default 'kind' check (rolle in ('kind', 'elternteil')),
  name text not null default '',
  created_at timestamptz not null default now()
);

create function profil_anlegen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profil (user_id, rolle, name)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'rolle' = 'elternteil' then 'elternteil' else 'kind' end,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1))
  )
  on conflict do nothing;
  return new;
end $$;
revoke all on function profil_anlegen() from public, anon, authenticated;
create trigger auf_neuer_nutzer after insert on auth.users
  for each row execute function profil_anlegen();

-- bestehende Konten werden Kinder-Konten
insert into profil (user_id, name)
select id, split_part(email, '@', 1) from auth.users
on conflict do nothing;

create table eltern_kind (
  eltern_id uuid not null references profil (user_id) on delete cascade,
  kind_id uuid not null references profil (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (eltern_id, kind_id),
  check (eltern_id <> kind_id)
);
create index on eltern_kind (kind_id);

create table einladung (
  code text primary key,
  kind_id uuid not null unique references profil (user_id) on delete cascade,
  gueltig_bis timestamptz not null
);

-- Tagesziel und Belohnung je Kind (von den Eltern einstellbar)
create table zeitregel (
  kind_id uuid primary key references profil (user_id) on delete cascade,
  tagesziel integer not null default 15 check (tagesziel between 1 and 500),
  minuten integer not null default 30 check (minuten between 0 and 600)
);

-- Zeitkonto: positive Buchungen = verdient, negative = eingelöst
create table zeitbuchung (
  id uuid primary key default gen_random_uuid(),
  kind_id uuid not null references profil (user_id) on delete cascade,
  minuten integer not null check (minuten <> 0),
  grund text not null check (grund in ('tagesziel', 'einloesung')),
  datum date not null default heute_berlin(),
  created_at timestamptz not null default now()
);
create unique index zeitbuchung_ein_tagesziel_pro_tag on zeitbuchung (kind_id, datum) where grund = 'tagesziel';
create index on zeitbuchung (kind_id, created_at);

-- Protokoll der Antworten (für Tagesziel und Lernkontrolle)
create table lernversuch (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vokabel_id uuid references vokabel (id) on delete set null,
  richtig boolean not null,
  created_at timestamptz not null default now()
);
create index on lernversuch (user_id, created_at);

create function ist_eltern_von(p_kind uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from eltern_kind where eltern_id = (select auth.uid()) and kind_id = p_kind)
$$;

-- Verknüpfung ------------------------------------------------------------------

create function einladungscode_erzeugen() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
begin
  if not exists (select 1 from profil where user_id = v_uid and rolle = 'kind') then
    raise exception 'Nur Kinder können einen Code erzeugen.';
  end if;
  for i in 1..8 loop
    v_code := v_code || substr(v_alphabet, 1 + (get_byte(uuid_send(gen_random_uuid()), 0) % 32), 1);
  end loop;
  delete from einladung where kind_id = v_uid;
  insert into einladung (code, kind_id, gueltig_bis) values (v_code, v_uid, now() + interval '24 hours');
  return v_code;
end $$;

create function code_einloesen(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_kind uuid;
begin
  if not exists (select 1 from profil where user_id = v_uid and rolle = 'elternteil') then
    raise exception 'Nur Eltern können einen Code einlösen.';
  end if;
  select kind_id into v_kind from einladung
  where code = upper(trim(p_code)) and gueltig_bis > now();
  if v_kind is null then
    raise exception 'Der Code ist ungültig oder abgelaufen.';
  end if;
  insert into eltern_kind (eltern_id, kind_id) values (v_uid, v_kind) on conflict do nothing;
  insert into zeitregel (kind_id) values (v_kind) on conflict do nothing;
  delete from einladung where kind_id = v_kind;
  return v_kind;
end $$;

-- Kind oder Elternteil kann die Verknüpfung lösen
create function verknuepfung_loesen(p_eltern uuid, p_kind uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() not in (p_eltern, p_kind) then
    raise exception 'Nicht erlaubt.';
  end if;
  delete from eltern_kind where eltern_id = p_eltern and kind_id = p_kind;
end $$;

-- Tagesziel und Zeitkonto ----------------------------------------------------------

-- Für das Kind: Stand von heute; schreibt beim Erreichen des Ziels einmal pro Tag gut.
create function tagesziel_status() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_regel zeitregel%rowtype;
  v_heute integer;
  v_neu integer := 0;
  v_rows integer;
begin
  select * into v_regel from zeitregel where kind_id = v_uid;
  select count(*) into v_heute from lernversuch
  where user_id = v_uid and richtig and created_at >= tagesbeginn_berlin();

  if v_regel.kind_id is not null and v_regel.minuten > 0 and v_heute >= v_regel.tagesziel then
    insert into zeitbuchung (kind_id, minuten, grund) values (v_uid, v_regel.minuten, 'tagesziel')
    on conflict (kind_id, datum) where grund = 'tagesziel' do nothing;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then v_neu := v_regel.minuten; end if;
  end if;

  return jsonb_build_object(
    'heute', v_heute,
    'ziel', v_regel.tagesziel,
    'minuten', v_regel.minuten,
    'neu_gutgeschrieben', v_neu,
    'saldo', coalesce((select sum(minuten) from zeitbuchung where kind_id = v_uid), 0)
  );
end $$;

create function kind_uebersicht(p_kind uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not ist_eltern_von(p_kind) then
    raise exception 'Nicht erlaubt.';
  end if;
  return jsonb_build_object(
    'name', (select name from profil where user_id = p_kind),
    'faecher', coalesce((select jsonb_object_agg(fach, n)
                         from (select fach, count(*) n from vokabel where user_id = p_kind group by fach) f), '{}'),
    'heute', (select count(*) from lernversuch
              where user_id = p_kind and richtig and created_at >= tagesbeginn_berlin()),
    'ziel', (select tagesziel from zeitregel where kind_id = p_kind),
    'minuten', (select minuten from zeitregel where kind_id = p_kind),
    'saldo', (select coalesce(sum(minuten), 0) from zeitbuchung where kind_id = p_kind),
    'tage', coalesce((
      select jsonb_agg(jsonb_build_object('datum', d, 'richtig', r, 'falsch', f) order by d desc)
      from (select (created_at at time zone 'Europe/Berlin')::date d,
                   count(*) filter (where richtig) r,
                   count(*) filter (where not richtig) f
            from lernversuch
            where user_id = p_kind and created_at >= now() - interval '7 days'
            group by 1) t), '[]')
  );
end $$;

create function zeit_einloesen(p_kind uuid, p_minuten integer) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_saldo integer;
begin
  if not ist_eltern_von(p_kind) then
    raise exception 'Nicht erlaubt.';
  end if;
  if p_minuten is null or p_minuten <= 0 then
    raise exception 'Bitte eine Minutenzahl größer 0 angeben.';
  end if;
  select coalesce(sum(minuten), 0) into v_saldo from zeitbuchung where kind_id = p_kind;
  if p_minuten > v_saldo then
    raise exception 'Das Guthaben reicht nicht (% Minuten).', v_saldo;
  end if;
  insert into zeitbuchung (kind_id, minuten, grund) values (p_kind, -p_minuten, 'einloesung');
  return v_saldo - p_minuten;
end $$;

-- Aufrufrechte: nur angemeldete Nutzer
do $$
declare f text;
begin
  foreach f in array array[
    'ist_eltern_von(uuid)', 'einladungscode_erzeugen()', 'code_einloesen(text)',
    'verknuepfung_loesen(uuid, uuid)', 'tagesziel_status()', 'kind_uebersicht(uuid)',
    'zeit_einloesen(uuid, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- RLS -----------------------------------------------------------------------------

alter table profil enable row level security;
alter table eltern_kind enable row level security;
alter table einladung enable row level security;   -- keine Policy: nur über Funktionen
alter table zeitregel enable row level security;
alter table zeitbuchung enable row level security;
alter table lernversuch enable row level security;

create policy profil_lesen on profil for select to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from eltern_kind e where e.eltern_id = (select auth.uid()) and e.kind_id = profil.user_id)
  or exists (select 1 from eltern_kind e where e.kind_id = (select auth.uid()) and e.eltern_id = profil.user_id)
);
create policy profil_name_aendern on profil for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy eltern_kind_lesen on eltern_kind for select to authenticated
  using (eltern_id = (select auth.uid()) or kind_id = (select auth.uid()));

create policy zeitregel_lesen on zeitregel for select to authenticated
  using (kind_id = (select auth.uid()) or ist_eltern_von(kind_id));
create policy zeitregel_eltern_aendern on zeitregel for update to authenticated
  using (ist_eltern_von(kind_id)) with check (ist_eltern_von(kind_id));

create policy zeitbuchung_lesen on zeitbuchung for select to authenticated
  using (kind_id = (select auth.uid()) or ist_eltern_von(kind_id));

create policy lernversuch_eigene on lernversuch for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Ändern darf jeder nur den eigenen Namen, nie die Rolle
revoke update on profil from authenticated, anon;
grant update (name) on profil to authenticated;
