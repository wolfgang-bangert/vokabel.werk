-- Kapitelverwaltung: eigene Vokabeln können einem Kapitel zugeordnet werden,
-- damit beim Lernen gezielt ein oder mehrere Kapitel ausgewählt werden können.

alter table vokabel add column if not exists kapitel text;
create index if not exists vokabel_kapitel_idx on vokabel (user_id, kapitel);
