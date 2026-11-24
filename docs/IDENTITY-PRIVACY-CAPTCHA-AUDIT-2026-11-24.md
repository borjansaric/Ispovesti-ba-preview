# Ispovesti.ba — audit anonimnog identiteta, privatnosti i CAPTCHA

Datum pregleda: 24. novembar 2026.  
Opseg: preview repozitorijum i read-only pregled povezanog Supabase projekta.  
Status: nalaz i otvorene odluke; nije implementaciono odobrenje.

## 1. Granice pregleda

Pregledani su preview frontend, preview Edge Function `community-test-api` (aktivna verzija 17), live Edge Function `community-live-api` (aktivna verzija 5), relevantne PostgreSQL funkcije, tabele, ključevi i strani ključevi.

Nisu mijenjani:
- produkcioni repozitorijum ili deployment;
- Supabase šeme, Auth, Edge Functions, podešavanja ili podaci;
- CAPTCHA ključevi ili podešavanja.

Nisu izvršeni browser E2E, Android/iPhone PWA, penetracioni ili testovi stvarnog Cloudflare izazova. Ovo je statički pregled koda i read-only pregled baze.

## 2. Šta je trenutno implementirano u preview/test okruženju

### 2.1 Anonimna sesija

- Preview konfiguracija koristi režim `live-test`, namjenski Supabase projekat i testne API endpoint-e.
- Frontend koristi odvojeni Auth storage ključ `ispovesti-preview-user-session`; administrativni ključ je takođe odvojen.
- Posjetilac dobija anonimnu Supabase Auth sesiju. Nije potrebno da unese e-mail, lozinku ili pravo ime.
- Auth UID je tehnički identifikator koji se koristi za server-side autorizaciju i privatne liste. Nije javni profil.

### 2.2 CAPTCHA tok

- Frontend pokreće `initializeSecurity()` pri inicijalizaciji aplikacije.
- `captcha_init` provjerava da li je za trenutni anonimni Auth UID već evidentirana potvrda.
- Ako potvrda ne postoji, Cloudflare Turnstile se pokreće sa akcijom `app_entry`.
- Server provjerava rezultat kod Cloudflare-a, očekivani hostname, akciju i vrijeme izazova.
- Nakon uspješne provjere server poziva privatni RPC `community_test_captcha_clearance` i čuva potvrdu za UID.
- Pri slanju sadržaja SQL funkcija `community_test_submit_check` provjerava da li je CAPTCHA uključena, podešena i potvrđena. Provjera se obavlja u server-side putanji slanja; klijentski parametar ne može sam proglasiti UID potvrđenim.
- Preview/test podešavanja u trenutku pregleda: CAPTCHA uključena, tajni ključ konfigurisan; očekivani hostname je `borjansaric.github.io`. Tajni ključ nije čitan niti prikazan.

### 2.3 Čuvanje CAPTCHA potvrde

Tabela `community_test.captcha_clearance` sadrži:
- `user_id` UUID — primarni ključ;
- `verified_at` timestamptz.

Tabela ima uključen RLS. Strani ključ prema `auth.users(id)` koristi `ON DELETE CASCADE`. RPC `community_test_captcha_clearance` ima EXECUTE privilegiju samo za `service_role` i `postgres` u provjerenom inventaru privilegija.

Potvrda nema vremenski rok u trenutno pregledanoj SQL funkciji: važi za dati Auth UID dok zapis postoji. Ako se lokalna sesija izgubi i napravi se novi anonimni UID, novi UID mora proći provjeru.

## 3. Razlika između testnog i live okruženja — blokator prije objave

U testnom okruženju postoji ulazni `captcha_init` i trajno evidentiranje potvrde po Auth UID-u.

U live okruženju, aktivna funkcija `community-live-api` v5 nema `captcha_init`, nema poziv `community_live_captcha_clearance`, a u bazi ne postoji `community_live.captcha_clearance` tabela. Live API pri svakoj radnji `submit` provjerava Cloudflare token sa akcijom `submit_confession`, `submit_comment` ili `submit_reply`.

Read-only pregled podešavanja pokazao je da su CAPTCHA podešavanja uključena i tajni ključ konfigurisan i u test i u live šemi. To ne znači da je tok jednak.

**Zaključak:** testni tok odgovara namjeri „CAPTCHA jednom pri prvom ulasku po anonimnom UID-u“, dok live tok i dalje zahtijeva CAPTCHA token pri svakom slanju. Ova razlika mora biti riješena i testirana prije bilo kakve produkcione objave. Ne mijenjati live funkciju ili bazu u okviru ovog audita.

## 4. ECDSA / identitet instalacije

U pregledanom preview kodu i tabelama test/live šema nisu pronađeni:
- `installation_id` registracija;
- ECDSA P-256 generisanje ili čuvanje javnog ključa;
- lokalno potpisivanje zahtjeva privatnim ključem;
- server-side provjera potpisa, nonce-a ili replay zaštite zasnovane na ključu instalacije.

Dakle, ECDSA identitet instalacije je i dalje projektni prijedlog, a ne implementirana ili testirana funkcija. Trenutni identitet je anonimni Supabase Auth UID.

Pre implementacije treba potvrditi:
1. da li se ECDSA ključ koristi kao dodatni dokaz instalacije uz Auth UID, ili zamjenjuje dio sadašnjeg modela;
2. kako se ključ registruje i veže za instalaciju bez javnog profila;
3. kako se obrađuju izgubljen uređaj, obrisani podaci pregledača, reinstalacija i rotacija ključa;
4. kako nonce i potpis pokrivaju tačno definisane radnje i sprečavaju replay;
5. kako se izbjegava trajni `author_ref` koji bi povezivao sve objave jedne osobe.

## 5. Auth brisanje i očuvanje objavljenog sadržaja

U test i live šemama `community_test.content.author_id` i `community_live.content.author_id` referenciraju `auth.users(id)` bez eksplicitnog `ON DELETE CASCADE` ili `ON DELETE SET NULL` — PostgreSQL podrazumijevano ponašanje je NO ACTION.

Slične Auth zavisnosti postoje i u privatnim listama, reakcijama/glasovima, prijavama, evidenciji ograničenja, računima i chat podacima. Posebno je potvrđeno da testna CAPTCHA potvrda koristi CASCADE, ali to ne rješava zavisnosti sadržaja i ostalih tabela.

**Zaključak:** zahtjev da objavljeni sadržaj ostane sačuvan nakon brisanja anonimnog Auth identiteta nije potvrđen. Ne mijenjati FK ponašanje dok se ne napravi potpuni inventar zavisnosti i odobri konkretan model očuvanja sadržaja.

## 6. Status prema projektnom dosijeu

| Stavka | Status nakon pregleda |
|---|---|
| Anonimni Auth UID bez javnog profila | Implementirano u preview/test; runtime ponašanje nije E2E potvrđeno |
| CAPTCHA jednom po UID-u | Implementirano u test backendu; nema roka trajanja; nije usklađeno sa live tokom |
| CAPTCHA bez ponavljanja pri svakom komentaru/odgovoru | Potvrđeno u test logici na nivou koda/SQL; nije potvrđeno u live |
| ECDSA P-256 identitet instalacije | Nije implementirano |
| Potpis, nonce i replay zaštita za identitet instalacije | Nije implementirano |
| Bez trajnog `author_ref` | Nije pronađena takva kolona u pregledanim šemama; potrebno je ponovo provjeriti pri dizajnu |
| Očuvanje sadržaja nakon Auth brisanja | Nije riješeno; FK NO ACTION zavisnosti ostaju |

## 7. Preporučeni redoslijed narednih koraka

1. Zaključiti model identiteta: Auth UID kao jedini tehnički identitet ili Auth UID uz ECDSA ključ instalacije.
2. Napisati i testirati specifikaciju registracije ključa, potpisivanja, nonce-a, replay zaštite, rotacije i gubitka ključa u preview-u.
3. Uskladiti test/live CAPTCHA tok u zasebnom, odobrenom implementacionom paketu; ne objavljivati live promjene bez posebne saglasnosti.
4. Napraviti potpuni Auth FK inventar i odobriti model očuvanja objavljenog sadržaja prije bilo kakvog brisanja identiteta.
5. Izvršiti browser testove na Androidu i iPhone PWA, uključujući gubitak sesije i ponovno otvaranje aplikacije.

## 8. Evidencija promjena

Ovaj dokument je dodan samo u preview repozitorijum kao audit zapis. Nema izmjena frontend logike, SQL-a, Supabase funkcija, Auth podešavanja ili produkcije.
