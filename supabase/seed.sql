
-- Seed (ansatte, sager, tildelinger, serienumre)
insert into employees (id, name, role, language, pin, initials, payroll_no) values
  ('emp-ole', 'Ole', 'mester', 'da', '7777', 'OL', null),
  ('emp-federico', 'Federico', 'mester', 'es', '2222', 'FO', null),
  ('emp-alex', 'Alex', 'laerling', 'da', '1111', 'AL', null),
  ('emp-ion', 'Ion Zafier', 'svend', 'ro', '3333', 'IZ', null),
  ('emp-marius', 'Marius Pater', 'svend', 'pl', '4444', 'MP', null),
  ('emp-osvaldo', 'Osvaldo', 'svend', 'es', '5555', 'OS', '0003')
on conflict (id) do update set name = excluded.name, role = excluded.role, language = excluded.language, pin = excluded.pin, initials = excluded.initials, payroll_no = excluded.payroll_no;

insert into projects (id, name, address, lat, lng, radius_m, brief, huddle, next_task, status, customer, created_by, udbud_folder_id, source, ks_type, handed_over_at, archived_at) values
  ('job-hillerodsholm', 'Hillerødsholm', 'Selskovvej 24–26, 3400 Hillerød', 55.9298, 12.3105, 180, 'NAB afd. 4121. Eksisterende 360 mm mur, hulmur 1.–2. sal. Indblæst stenuld, bindere, omfugning. Dalux + Drive.', 'I dag: altan-rep 5.4, filsning vange 5.5, udkasning skorsten 5.7. 64 KS-fotos i Drive — ret Grok hvis forkert.', 'KS 5.4 / 5.5 / 5.7 — åbn foto, ret punkt hvis Grok tager fejl.', 'active', 'Ole Jepsen A/S', 'emp-ole', '1sY1Zxbb0KN9tWZITKun_JQ3Kom9LDSc_', 'Dalux + Google Drev', 'alm', null, null),
  ('job-islevvaenge', 'Islevvænge', 'Fortvej 50, 2610 Rødovre', 55.7034, 12.4535, 200, 'Arne Jacobsen-rækkehuse, Rødovre afd. 2304. Gule og røde huse Fortvej/Knudsbølvej. Udbud: ISV_K01_C08.2_Zmur og Ztag i 01 Udbud.', 'Uge 37 man: puds gavle røde Fortvej. Fuger 20 mm, KC 50/50/700, skrabefuge, ingen afsyring.', 'Puds gavle røde huse, Fortvej — se Zmur 213.202.', 'active', 'Ole Jepsen A/S', 'emp-ole', '1jrKrS6Q0T7Sa1cfbr-wYDejr-r2KGsBx', 'Byggeweb', 'alm', null, null),
  ('job-kaerhuset', 'Kærhuset', 'Kær Bygade 8, 6400 Sønderborg', 54.9475, 9.851, 160, 'Mur og sokkel ved Kær. Ruskær 35 er samme sag. Afdækning ved nedbør. Drive.', 'Sokkelmembran 5.1 og afdækning 6.1. Stillads mod gadekæret.', 'KS 5.1 — sokkelmembran, 200 mm over terræn.', 'active', 'Ole Jepsen A/S', 'emp-ole', '1b4TUbmrrOr7xc8EuYHhZrsYYNUUVJPm4', 'Drive', 'alm', null, null),
  ('job-solbakkegaard', 'Solbakkegård', 'Vester Snogbæk 15, 6400 Sønderborg', 54.912, 9.792, 160, 'Gårdanlæg — tegl, overliggere og afdækning.', 'Overligger 4.1 i stuehuset. Afdæk murkrone inden aften.', 'KS 4.1 — ståloverligger HEA 160, stuehus øst.', 'archived', 'Ole Jepsen A/S', 'emp-ole', '12PaFXLv0PE-Tk4Mp20eGhwNQseQuo8Sx', 'Dalux', null, '2025-09-01', '2025-09-01T12:00:00.000Z'),
  ('job-skole', 'Skole', 'Skole (sted mangler i Dataløn)', 55.93, 12.31, 120, 'Tre dage i marts: fuge out. Sagsnummer stod tomt i Dataløn.', 'Fuge out.', 'Fuge out.', 'archived', 'Ole Jepsen A/S', 'emp-ole', '10ZI4-PFoenKHU0ezBbCrAauAkgCHxilI', 'Dataløn-kommentar', null, '2021-09-15', '2021-09-15T12:00:00.000Z'),
  ('job-soren-privat', 'Søren privat', 'Privat sag — adresse mangler', 55.676, 12.568, 120, 'Lille privat sag. Adresse mangler. Samme mappetræ som Hillerødsholm.', 'Uge 37 tirsdag: Marius.', 'Udførsel tirsdag.', 'active', 'Privat', 'emp-ole', '1rSzZ5M_Gma3PUgE0Hf2Nr8LtSxBdFkl_', 'Oprettet af mester-bot', null, null, null),
  ('job-klostergaarden', 'Klostergården Hillerød', 'Klostervej 1–15, 3400 Hillerød', 55.9324, 12.2978, 160, 'Lejerbo Klostergården. Samme mappetræ som Hillerødsholm: 01–07 + 00 Admin.', 'Uge 37: Federico og Osvaldo.', 'Udførsel uge 37.', 'active', 'Ole Jepsen A/S', 'emp-ole', '1jzE96Pk4T3POs2i7_LtU-LXMclKx5NMX', 'Oprettet af mester-bot', null, null, null),
  ('job-provestenen', 'Prøvestenen Frederiksværk', 'Strandvejen 84, 3300 Frederiksværk', 55.9706, 11.9985, 160, 'Strandvejen 84. Fuge out blok C/D, sten og vindueslysninger. Puds kælder uge 37.', 'Uge 37 tirsdag–onsdag: Ole og Alex, puds kælder.', 'Puds kælder tirsdag og onsdag.', 'active', 'Ole Jepsen A/S', 'emp-ole', '14L-6haGCy5Yg6mB_00dsfX5KvRj52k66', 'Dataløn 2501 + mester-bot', null, null, null)
on conflict (id) do update set name = excluded.name, address = excluded.address, brief = excluded.brief, huddle = excluded.huddle, next_task = excluded.next_task, status = excluded.status;

insert into assignments (employee_id, project_id) values
  ('emp-ole', 'job-hillerodsholm'),
  ('emp-ole', 'job-islevvaenge'),
  ('emp-ole', 'job-kaerhuset'),
  ('emp-ole', 'job-solbakkegaard'),
  ('emp-federico', 'job-hillerodsholm'),
  ('emp-federico', 'job-islevvaenge'),
  ('emp-federico', 'job-kaerhuset'),
  ('emp-federico', 'job-solbakkegaard'),
  ('emp-alex', 'job-hillerodsholm'),
  ('emp-ion', 'job-hillerodsholm'),
  ('emp-ion', 'job-islevvaenge'),
  ('emp-marius', 'job-hillerodsholm'),
  ('emp-marius', 'job-kaerhuset'),
  ('emp-osvaldo', 'job-hillerodsholm'),
  ('emp-osvaldo', 'job-islevvaenge'),
  ('emp-osvaldo', 'job-kaerhuset'),
  ('emp-osvaldo', 'job-provestenen'),
  ('emp-ole', 'job-soren-privat'),
  ('emp-ole', 'job-klostergaarden'),
  ('emp-ole', 'job-provestenen'),
  ('emp-federico', 'job-soren-privat'),
  ('emp-federico', 'job-klostergaarden'),
  ('emp-federico', 'job-provestenen'),
  ('emp-marius', 'job-islevvaenge'),
  ('emp-marius', 'job-soren-privat'),
  ('emp-alex', 'job-islevvaenge'),
  ('emp-alex', 'job-provestenen'),
  ('emp-osvaldo', 'job-klostergaarden')
on conflict do nothing;

insert into serials (kind, next, year) values
  ('as', 6, 2026), ('tf', 7, 2026), ('er', 1, 2026), ('ks', 5, 2026), ('mo', 1, 2026), ('fb', 1, 2026)
on conflict (kind) do nothing;
