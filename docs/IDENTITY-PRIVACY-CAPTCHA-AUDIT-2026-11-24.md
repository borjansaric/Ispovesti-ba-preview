# Ispovesti.ba — audit anonimnog identiteta, privatnosti i CAPTCHA

Datum pregleda: 24. novembar 2026.  
Dopuna: precizno praćenje frontend–Edge Function–SQL toka i usaglašavanje projektnih odluka.  
Opseg: preview repozitorijum i read-only pregled povezanog Supabase projekta.  
Status: nalaz i preporučeni naredni koraci; nije odobrenje za produkcione izmjene.

## 1. Granice pregleda

Pregledani su:
- preview frontend: `config.js`, `api.js`, `captcha.js`, `app.js`;
- produkcioni frontend: isti fajlovi, samo za read-only poređenje;
- aktivne Edge Functions `community-test-api` v17 i `community-live-api` v5;
- relevantne PostgreSQL funkcije, CAPTCHA podešavanja, tabele i Auth strani ključevi.

Nisu mijenjani:
- produkcioni repozitorijum ili deployment;
- Supabase šeme, Auth, Edge Functions, podešavanja ili podaci;
- CAPTCHA ključevi ili podešavanja.

Nisu izvršeni browser E2E, Android/iPhone PWA, penetracioni ili testovi stvarnog Cloudflare izazova. Ovo je statički pregled koda i read-only pregled baze.

## 2. Preview/test tok — potvrda jednom po anonimnom UID-u

### 2.1 Konfiguracija i sesija

- Preview `config.js` koristi režim `live-test`, testno chat okruženje i namjenski Supabase projekat.
- Pošto je režim `live-test`, `isPreview` je `false`; zahtjevi ne idu u lokalni browser mock.
- Preview `api.js` šalje API zahtjeve na `community-test-api`.
- Frontend koristi odvojeni Auth storage ključ `ispovesti-preview-user-session`; administrativni ključ je takođe odvojen.
- Posjetilac dobija anonimnu Supabase Auth sesiju. Nije potrebno da unese e-mail, lozinku ili pravo ime.
- Auth UID je tehnički identifikator za server-side autorizaciju i privatne liste. Nije javni profil.

### 2.2 CAPTCHA pri ulasku

1. Preview `app.js` poziva `initializeSecurity()` pri pokretanju aplikacije.
2. `api.js` šalje `captcha_init` na `community-test-api`.
3. Backend provjerava postoji li potvrda za trenutni UID u `community_test.captcha_clearance`.
4. Ako potvrda ne postoji, frontend pokreće Cloudflare Turnstile sa akcijom `app_entry`.
5. `community-test-api` provjerava Cloudflare rezultat, očekivani hostname, akciju i vrijeme izazova.
6. Nakon uspjeha backend poziva privatni RPC `community_test_captcha_clearance` i evidentira potvrdu za UID.

### 2.3 CAPTCHA pri slanju

- Pri slanju frontend ponovo poziva `ensureCaptchaClearance`, ali za već potvrđeni UID ne traži novi izazov.
- SQL funkcija `community_test_dispatch_base` poziva `community_test_submit_check` unutar server-side transakcije slanja.
- SQL provjerava da je CAPTCHA uključena, da je tajna podešena i da UID ima potvrdu.
- Klijentski parametar ne može sam proglasiti UID potvrđenim.
- Potvrda nema vremenski rok u trenutno pregledanoj SQL funkciji: važi za dati Auth UID dok zapis postoji. Novi UID mora proći provjeru.

Tabela `community_test.captcha_clearance` sadrži:
- `user_id` UUID — primarni ključ;
- `verified_at` timestamptz.

Tabela ima uključen RLS. Strani ključ prema `auth.users(id)` koristi `ON DELETE CASCADE`. RPC `community_test_captcha_clearance` ima EXECUTE privilegiju samo za `service_role` i `postgres` u provjerenom inventaru privilegija.

## 3. Produkcioni tok — CAPTCHA pri svakom slanju

- Produkcioni `config.js` koristi režim `live`.
- Produkcioni `api.js` šalje sadržaj na `community-live-api`.
- Produkcioni `api.js` pribavlja Turnstile token za svako slanje, sa akcijom `submit_confession`, `submit_comment` ili `submit_reply`.
- Aktivni `community-live-api` v5 provjerava token koristeći live sigurnosna podešavanja, uključujući hostname i očekivanu akciju.
- Live SQL dispatcher ne koristi tabelu potvrde po UID-u; u live šemi nije pronađena `community_live.captcha_clearance` tabela niti live `captcha_init` akcija.

### 3.1 Dodatno pronađeno povezivanje pogrešnog endpointa

Produkcioni `captcha.js` trenutno dohvaća javni CAPTCHA `sitekey` i `enabled` status sa `community-test-api`, iako produkcioni zahtjevi i provjera tokena idu na `community-live-api`.

U trenutku pregleda javna podešavanja test i live šeme su bila jednaka:
- CAPTCHA uključena u oba okruženja;
- isti javni sitekey;
- isti očekivani hostname: `borjansaric.github.io`;
- tajna je podešena u oba okruženja (vrijednost tajne nije čitana).

Zato ovo trenutno nije dokaz da CAPTCHA ne radi. Ipak, frontend produkcije zavisi od test konfiguracije, dok live backend provjerava live konfiguraciju. Ako se podešavanja raziđu, izazov može biti napravljen za pogrešan sitekey. Produkcioni `captcha.js` treba kasnije usmjeriti na `community-live-api`, ali ta izmjena nije urađena.

**Zaključak:** preview/test i produkcija imaju dva različita modela:
- preview/test: CAPTCHA jednom po anonimnom Auth UID-u;
- produkcija: CAPTCHA token pri svakom slanju.

Razlika mora biti namjerno razriješena prije produkcione objave. Preporučeni cilj za platformu je potvrda jednom po UID-u, kako komentari i odgovori ne bi stalno pokretali novu provjeru; live implementacija tog modela zahtijeva zasebno odobren i testiran paket izmjena. Ne mijenjati live funkciju ili bazu u okviru ovog audita.

## 4. Odluka o identitetu instalacije

ECDSA P-256 identitet instalacije je **odbačen kao nepotrebna komplikacija** i isključen iz plana. Ne praviti instalacioni ključ, potpisivanje zahtjeva, nonce sistem niti replay zaštitu zasnovanu na ECDSA.

Trenutni tehnički identitet ostaje anonimni Supabase Auth UID. Ne uvoditi dodatni trajni identifikator koji bi nepotrebno povezivao objave jedne osobe.

## 5. Auth brisanje i očuvanje objavljenog sadržaja

Read-only SQL inventar direktnih stranih ključeva prema `auth.users` u šemama `chat_live`, `chat_test`, `community_live` i `community_test` pokazao je:
- **55 direktnih stranih ključeva ukupno**;
- **54 sa ponašanjem NO ACTION**;
- **1 sa ON DELETE CASCADE** — testna `community_test.captcha_clearance.user_id`.

Prethodno prijavljeni zbir od 56 bio je greška u sabiranju; ispravan rezultat je 55.

Posebno, `community_test.content.author_id` i `community_live.content.author_id` nemaju eksplicitni `ON DELETE CASCADE` ili `ON DELETE SET NULL`; podrazumijevano ponašanje je NO ACTION. Zavisnosti postoje i u privatnim listama, reakcijama/glasovima, prijavama, evidenciji ograničenja i chat podacima.

**Zaključak:** zahtjev da objavljeni sadržaj ostane sačuvan nakon brisanja anonimnog Auth identiteta nije potvrđen kao riješen. Ne mijenjati FK ponašanje dok se ne odobri konkretan model očuvanja sadržaja.

## 6. Status prema projektnom dosijeu

| Stavka | Status nakon pregleda |
|---|---|
| Anonimni Auth UID bez javnog profila | Implementirano u preview/test; runtime ponašanje nije E2E potvrđeno |
| CAPTCHA jednom po UID-u | Implementirano u test backendu; nema roka trajanja |
| CAPTCHA pri svakom slanju | Trenutni live model |
| Produkcioni CAPTCHA config endpoint | Frontend trenutno čita javni sitekey iz test API-ja; treba usmjeriti na live API |
| ECDSA identitet instalacije | Odbijeno; van opsega |
| Trajni javni `author_ref` | Nije pronađen u pregledanim šemama |
| Očuvanje sadržaja nakon Auth brisanja | Nije riješeno; 55 direktnih Auth FK veza, 54 NO ACTION |

## 7. Preporučeni redoslijed narednih koraka

1. Zadržati anonimni Auth UID kao jedini tehnički identitet; ECDSA ostaje isključen.
2. U preview-u dodati i provjeriti testove za: prvi ulazak, postojeću potvrdu, novi UID, neuspješan/istekao Turnstile token i odbijanje slanja bez potvrde.
3. Pripremiti zaseban implementacioni paket za live: CAPTCHA jednom po UID-u, live clearance tabela/RPC, atomska SQL provjera i promjena produkcionog frontend endpointa. Ništa od toga ne objavljivati bez posebnog odobrenja.
4. Napraviti i odobriti model očuvanja objavljenog sadržaja prije bilo kakvog brisanja Auth identiteta.
5. Izvršiti browser testove na Androidu i iPhone PWA, uključujući gubitak sesije i ponovno otvaranje aplikacije.

## 8. Evidencija promjena

Ovaj dokument se ažurira samo u preview repozitorijumu. Nema izmjena frontend logike, SQL-a, Supabase funkcija, Auth podešavanja ili produkcije.
