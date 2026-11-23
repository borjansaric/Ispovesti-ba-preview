# Ispovesti.ba — testni preview

Ovaj repozitorijum sadrži testni frontend Ispovesti.ba. Deployment se objavljuje isključivo na GitHub Pages adresi:

https://borjansaric.github.io/Ispovesti-ba-preview/

## Povezana testna infrastruktura

Konfiguracija u `config.js` koristi režim `live-test` i povezuje frontend sa namjenskim testnim API endpointima u Supabase projektu **Ispovesti-ba**:

- `community-test-api` — sadržaj zajednice, komentari, reakcije i CAPTCHA;
- `chat-test-api` — testni anonimni chat;
- `community_test` i `chat_test` — odvojene testne PostgreSQL šeme.

Testne i live šeme nalaze se u istom Supabase projektu, ali su odvojene na nivou šema, Edge Functions i server-side pristupa. Preview frontend koristi testne endpoint-e; ne smije se preusmjeravati na live endpoint-e.

## Build i deployment

GitHub Actions workflow `.github/workflows/preview.yml` pokreće `scripts/build.mjs`, pravi `dist` sa hashiranim lokalnim resursima i objavljuje ga na GitHub Pages preview adresu. Workflow je vezan za `main` granu ovog preview repozitorijuma. Produkcijski repozitorijum `borjansaric/Ispovesti-ba` nije cilj ovog workflowa.

## Sigurnosne napomene

- Preview koristi zasebne browser Auth storage ključeve `ispovesti-preview-user-session` i `ispovesti-preview-admin-session`. Ne dijeli ih sa produkcijskim ili ranijim generičkim test ključevima. Ovo razdvaja sesije u istom browser origin-u; ne predstavlja zaseban Supabase Auth projekat.

- Javni publishable ključ u `config.js` nije server tajna; service-role ključevi i CAPTCHA tajni ključ ostaju na serveru.
- Testne šeme nisu direktno izložene anonimnom SQL pristupu; zahtjevi prolaze kroz Edge Function gateway.
- CAPTCHA clearance se provjerava server-side i vezuje za anonimni Auth UID. Nakon uspješne provjere ne traži se novi izazov pri svakom komentaru ili odgovoru.
- Ne koristiti stvarne lične podatke u testiranju.

Ovaj preview nije izolovan lokalni mock: koristi stvarnu testnu Supabase infrastrukturu. Podaci koje pošalješ preko previewa čuvaju se u testnom backendu, a ne samo u lokalnom pregledniku.
