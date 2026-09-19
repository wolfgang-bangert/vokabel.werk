-- Testdaten für die zentrale Quelle (quelle = 'testdaten'), damit Rechtschreibhilfe,
-- Eselsbrücken und Sprachbrücken ausprobiert werden können.
-- Entfernen: delete from zentrale_vokabel where quelle = 'testdaten';

insert into zentrale_vokabel (sprache, wort, deutsch, quelle) values
  ('en', 'father',  'Vater',   'testdaten'),
  ('en', 'mother',  'Mutter',  'testdaten'),
  ('en', 'brother', 'Bruder',  'testdaten'),
  ('en', 'house',   'Haus',    'testdaten'),
  ('en', 'apple',   'Apfel',   'testdaten'),
  ('en', 'night',   'Nacht',   'testdaten'),
  ('en', 'water',   'Wasser',  'testdaten'),
  ('en', 'book',    'Buch',    'testdaten'),
  ('en', 'bread',   'Brot',    'testdaten'),
  ('en', 'friend',  'Freund',  'testdaten'),
  ('la', 'pater',   'Vater',   'testdaten'),
  ('la', 'mater',   'Mutter',  'testdaten'),
  ('la', 'frater',  'Bruder',  'testdaten'),
  ('la', 'domus',   'Haus',    'testdaten'),
  ('la', 'aqua',    'Wasser',  'testdaten'),
  ('la', 'nox',     'Nacht',   'testdaten'),
  ('la', 'stella',  'Stern',   'testdaten'),
  ('la', 'liber',   'Buch',    'testdaten'),
  ('la', 'amicus',  'Freund',  'testdaten'),
  ('la', 'panis',   'Brot',    'testdaten')
on conflict do nothing;

insert into eselsbruecke (zentral_id, text)
select z.id, e.text
from (values
  ('en', 'father',  'father klingt fast wie Vater: das f ist unser v.'),
  ('en', 'mother',  'mother klingt wie Mutter, nur das t wird zum weichen th.'),
  ('en', 'brother', 'brother klingt wie Bruder, das d wird zum th.'),
  ('en', 'house',   'house und Haus sehen fast gleich aus, nur das u wird zu ou.'),
  ('en', 'apple',   'apple und Apfel: aus dem pf wird ein einfaches p.'),
  ('en', 'night',   'night ist Nacht: das gh steht für das ch in Nacht.'),
  ('en', 'water',   'water und Wasser: das t wird zum ss.'),
  ('en', 'book',    'Buch heißt book: aus dem ch wird ein k.'),
  ('en', 'bread',   'bread und Brot klingen ähnlich, stell dir ein Brot im Bett (bed) vor.'),
  ('en', 'friend',  'friend und Freund: das fr am Anfang bleibt, nur das d hinten kommt dazu.'),
  ('la', 'pater',   'Pater kennst du aus Vaterunser (Pater noster) und Patenonkel.'),
  ('la', 'mater',   'Denk an Maternity und an Mama: mater ist die Mutter.'),
  ('la', 'frater',  'Fraternität oder Fratello: frater ist der Bruder.'),
  ('la', 'domus',   'Ein Dom ist Gottes Haus, und Domizil ist der Wohnsitz.'),
  ('la', 'aqua',    'Aquarium: ein Haus für Wasser-Tiere.'),
  ('la', 'nox',     'Nocturne ist ein Nachtstück, nachtaktive Tiere heißen nokturn.'),
  ('la', 'stella',  'Konstellation heißt Sternbild, und Stella ist ein Mädchenname für Stern.'),
  ('la', 'liber',   'Ein Libretto ist das kleine Buch zu einer Oper.'),
  ('la', 'amicus',  'Amigo, Amie, amikal: alle kommen von amicus, dem Freund.'),
  ('la', 'panis',   'Panini heißt kleine Brote, und Pane ist italienisch für Brot.')
) as e (sprache, wort, text)
join zentrale_vokabel z on z.sprache = e.sprache and z.wort = e.wort and z.quelle = 'testdaten'
where not exists (select 1 from eselsbruecke b where b.zentral_id = z.id);

insert into sprachbruecke (en_id, la_id, text)
select en.id, la.id, b.text
from (values
  ('father',  'pater',  'Lateinisches p wird im Englischen oft zu f: pater, father. Genauso pes und foot.'),
  ('mother',  'mater',  'mater und mother: das t wird zum th, sonst fast gleich.'),
  ('brother', 'frater', 'Lateinisches f wird zu englischem b: frater, brother.'),
  ('house',   'domus',  'Beide meinen das Haus: aus domus wird im Englischen domestic (häuslich).'),
  ('water',   'aqua',   'aqua und water meinen beides Wasser: Aquarium und Watertank.'),
  ('night',   'nox',    'nox und night: das n am Anfang und das t am Ende bleiben erhalten.'),
  ('book',    'liber',  'Ein Buch heißt liber, davon kommt library, die Bücherei.'),
  ('friend',  'amicus', 'friend und amicus: friendly (freundlich) und amicable (freundschaftlich).'),
  ('bread',   'panis',  'panis ist Brot; ein Panini ist ein belegtes Brötchen.')
) as b (en_wort, la_wort, text)
join zentrale_vokabel en on en.sprache = 'en' and en.wort = b.en_wort and en.quelle = 'testdaten'
join zentrale_vokabel la on la.sprache = 'la' and la.wort = b.la_wort and la.quelle = 'testdaten'
on conflict do nothing;
