# Anonimna analitika posjetilaca — v1

## Opseg
- Važi samo za testno okruženje Ispovesti.ba.
- Evidentira najviše jedan red po nasumičnom identifikatoru pregledača i UTC danu.
- Ne koristi niti čuva Auth UID, ime, e-mail, IP adresu, putanju stranice ili tekst ispovijesti/komentara.
- Pregledač čuva nasumični UUID u first-party localStorage prostoru.
- Testni Edge Function prima UUID, izračunava serverski zaštićeni SHA-256 sažetak i u bazu šalje samo sažetak.
- U bazi se čuvaju samo sažetak i UTC datum; RLS je uključen, a direktan pristup anon/authenticated ulogama je ukinut.
- Zapisi stariji od 180 dana brišu se prilikom novog upisa.

## Metrike
- Jedinstveni pregledači u posljednjih 30 dana.
- Novi pregledači: prva zabilježena posjeta u posljednjih 30 dana.
- Povratnici: jedinstveni pregledači u posljednjih 30 dana čija je prva zabilježena posjeta starija od tog perioda.
- Zadržavanje na 10, 20. i 30. dan: udio pregledača koji su se vratili tačno tog dana nakon prve zabilježene posjete. Za svaki period koristi se do 30 dnevnih kohorti koje su dovoljno stare da se povratak može izmjeriti.

## Ograničenja
- Mjerenje počinje tek nakon uključivanja ove verzije; ranije posjete se ne mogu rekonstruisati.
- Identifikator važi samo u istom pregledaču i na istom uređaju. Drugi uređaj, drugi pregledač ili brisanje podataka sajta može se prikazati kao novi pregledač.
- Ovo je pseudonimna statistika pregledača, ne dokaz identiteta jedne osobe.
- Broj pregledača nije isto što i broj sesija ili broj otvorenih stranica.
- Produkcijsko okruženje nije izmijenjeno.
