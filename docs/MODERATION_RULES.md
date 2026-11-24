# Ispovesti.ba — automatizovana moderacija chata (test)

**Datum:** 25. novembar 2026.  
**Okruženje:** isključivo Preview / `chat-test-api` / šema `chat_test`  
**Status:** prva faza — oznake za ljudski pregled

## Odluka

Zbog uslova da nema novih troškova, prva faza ne koristi eksterni AI API niti plaćeni model. Koristi lokalna, deterministička pravila u Edge Function kodu. Zato se ova funkcionalnost ne predstavlja kao pravi AI model.

## Šta se označava

- direktne formulacije koje liče na prijetnju;
- prepoznatljive fraze reklamne ili „brze zarade“ poruke;
- poruke koje sadrže mogući broj telefona;
- neuobičajeno visok udio velikih slova u dužoj poruci;
- ponavljanje iste kratke fraze više puta.

Obične psovke, neslaganje, emotivno izražavanje i kritika sami po sebi nisu razlog za oznaku.

## Šta se ne radi

- poruka se ne briše, ne skriva i ne blokira automatski;
- ne izriče se kazna niti blokada naloga;
- ne šalju se poruke sadržaja eksternom AI servisu;
- ne mijenja se produkcijski chat niti produkcijski repozitorijum.

## Evidencija i pregled

Oznake se čuvaju u `public.chat_test_moderation_flags`, uz RLS i pristup samo serverskoj ulozi. Administratorski chat prikazuje razlog oznake, a administrator odlučuje da li će poruku ostaviti ili ukloniti postojećom moderatorskom radnjom.

Oznaka je signal za pregled, ne dokaz prekršaja. Pravila se moraju testirati na stvarnim primjerima prije razmatranja automatskog skrivanja sadržaja.
