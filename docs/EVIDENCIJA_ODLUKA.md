# Evidencija odluka — Ispovesti.ba

## 25. novembar 2026. — prva faza automatizovane moderacije chata

- Odobrena je besplatna, lokalna provjera poruka u Preview okruženju.
- Nije dodat OpenAI API ključ, eksterni model, kartica, naplata niti novi servis.
- Oznake se upisuju u zasebnu tabelu `public.chat_test_moderation_flags`; pristup je ograničen na serversku ulogu.
- Administratorski chat prikazuje razlog oznake.
- U ovoj fazi nema automatskog skrivanja, brisanja, kažnjavanja ni blokiranja.
- Produkcijski repozitorijum, `chat-live-api` i šema `chat_live` nisu predmet izmjene.
- Pravila su heuristička i mogu pogriješiti; svaku oznaku potvrđuje administrator.
