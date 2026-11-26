# Ispovesti.ba — administratorski izvještaj i evidencija radnji

**Datum:** 26. novembar 2026.  
**Okruženje:** Preview  
**Repozitorijum:** `borjansaric/Ispovesti-ba-preview`  
**Supabase:** `roxajqagksffbsbzdrap`, testne šeme `community_test` i `chat_test`

## Implementirano

- Prijave zajednice i chata imaju statuse `new`, `reviewed`, `resolved` i `dismissed`.
- Glavni administratorski panel prikazuje status prijave i omogućava promjenu statusa.
- Promjene statusa prijava evidentiraju se kao moderatorske radnje.
- Audit zapis podržava opcione razloge/detalje uz uklanjanje i vraćanje sadržaja, blokiranje/uklanjanje blokade i promjene reda objava.
- Pauziranje i nastavak automatskog objavljivanja evidentiraju se samo kada se stanje zaista promijeni.
- Glavni panel prikazuje detalje audit zapisa.
- Chat arhiva prikazuje status prijava; administratorski tok uklanjanja/vraćanja poruka i uklanjanja blokade evidentira razlog kada je unesen.
- Audit tabele imaju zaštitu od UPDATE, DELETE i TRUNCATE; `service_role` zadržava SELECT i INSERT, ali nema UPDATE, DELETE ni TRUNCATE privilegije.

## Postojeće funkcije koje su zadržane

- Kontrolna tabla i statistika sadržaja/reakcija.
- Anonimna analitika posjeta i povratnika sa zadržavanjem 10/20/30 dana.
- Red objava, arhiva, moderacija i automatske oznake za pregled.
- Automatske oznake ostaju samo upozorenja za administratora; ne uklanjaju sadržaj same.

## Provjere

- SQL definicije funkcija potvrđene nakon izmjene.
- Provjereno je da obje audit tabele imaju četiri append-only triggera (UPDATE/DELETE/TRUNCATE) i da `service_role` može samo čitati i dodavati zapise.
- Namjerni pokušaji UPDATE, DELETE i TRUNCATE nad chat audit tabelom blokirani su triggerima.
- `chat-test-api` je aktivan, verzija 17.
- GitHub Actions Preview build i deploy su uspješno završeni za commit `ef720aebd50f82cbe547623b47d240c1cd2dd3bc`; naredna izmjena audit zaštite i ovaj dokument pokreću novu provjeru.

## Ograničenja provjere

Na posljednjem pregledu nije bilo aktivne administratorske sesije, a testne tabele prijava bile su prazne. Zbog toga nije izvršen klik-po-klik test promjene statusa stvarne prijave kroz prijavljeni administratorski interfejs. To ne mijenja potvrđene SQL provjere, statičku provjeru koda i status deploya; taj završni UI smoke-test ostaje zasebna provjera.

Audit zaštita sprečava uobičajene izmjene preko `service_role`, ali nije kriptografski nepromjenjiv zapis: vlasnik baze/superuser i dalje ima privilegije za administraciju baze.
