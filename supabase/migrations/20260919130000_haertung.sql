-- Härtung nach Supabase-Advisor: feste search_path, keine anon-Aufrufe von
-- security-definer-Funktionen, pg_trgm nicht in public, auth.uid() nur einmal je Abfrage.

alter extension pg_trgm set schema extensions;

alter function norm(text) set search_path = '';
alter function intervall_stunden(uuid, smallint) set search_path = public;
alter function vokabel_zuordnen() set search_path = public;
alter function vokabel_vorschlaege(text, text) set search_path = public, extensions;

-- Trigger-Funktion darf niemand direkt per API aufrufen
revoke all on function vokabel_zuordnen() from public, anon, authenticated;
-- Vorschläge nur für angemeldete Kinder
revoke all on function vokabel_vorschlaege(text, text) from public, anon;
grant execute on function vokabel_vorschlaege(text, text) to authenticated;

drop policy vokabel_eigene on vokabel;
create policy vokabel_eigene on vokabel for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy lernintervall_eigene on lernintervall;
create policy lernintervall_eigene on lernintervall for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy eselsbruecke_lesen on eselsbruecke;
create policy eselsbruecke_lesen on eselsbruecke for select to authenticated
  using (exists (select 1 from vokabel v
                 where v.zentral_id = eselsbruecke.zentral_id and v.user_id = (select auth.uid())));

drop policy sprachbruecke_lesen on sprachbruecke;
create policy sprachbruecke_lesen on sprachbruecke for select to authenticated
  using (exists (select 1 from vokabel v
                 where v.zentral_id = sprachbruecke.en_id and v.user_id = (select auth.uid()))
     and exists (select 1 from vokabel v
                 where v.zentral_id = sprachbruecke.la_id and v.user_id = (select auth.uid())));
