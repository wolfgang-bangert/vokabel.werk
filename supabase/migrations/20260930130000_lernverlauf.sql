-- Verlauf für die Elternansicht: Ergebnis-Typ (richtig/tippfehler/falsch) und ein
-- Wort-Schnappschuss je Lernversuch, damit Rechtschreibfehler sichtbar werden und
-- die Historie unabhängig von einer später gelöschten Vokabel bestehen bleibt.

alter table lernversuch add column if not exists ergebnis text check (ergebnis in ('richtig', 'tippfehler', 'falsch'));
alter table lernversuch add column if not exists wort text;
alter table lernversuch add column if not exists deutsch text;

update lernversuch set ergebnis = case when richtig then 'richtig' else 'falsch' end where ergebnis is null;

create or replace function kind_uebersicht(p_kind uuid) returns jsonb
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
    'vorlesen', coalesce((select vorlesen_erlaubt from zeitregel where kind_id = p_kind), false),
    'saldo', (select coalesce(sum(minuten), 0) from zeitbuchung where kind_id = p_kind),
    'tippfehler_7t', (select count(*) from lernversuch
                       where user_id = p_kind and ergebnis = 'tippfehler' and created_at >= now() - interval '7 days'),
    'versuche_7t', (select count(*) from lernversuch
                     where user_id = p_kind and created_at >= now() - interval '7 days'),
    'tage', coalesce((
      select jsonb_agg(jsonb_build_object('datum', d, 'richtig', r, 'falsch', f) order by d desc)
      from (select (created_at at time zone 'Europe/Berlin')::date d,
                   count(*) filter (where richtig) r,
                   count(*) filter (where not richtig) f
            from lernversuch
            where user_id = p_kind and created_at >= now() - interval '7 days'
            group by 1) t), '[]'),
    'verlauf', coalesce((
      select jsonb_agg(jsonb_build_object('zeit', created_at, 'wort', wort, 'deutsch', deutsch, 'ergebnis', ergebnis) order by created_at desc)
      from (select created_at, wort, deutsch, ergebnis from lernversuch
            where user_id = p_kind order by created_at desc limit 30) t
    ), '[]')
  );
end $$;
