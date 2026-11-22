# ADMIN_PANEL_ISPOVESTI_BA_v1.0

**Projekat:** Ispovesti.ba  
**Verzija:** 1.0  
**Status:** DOGOVORENO — ZAKLJUČANA OSNOVA  
**Okruženje implementacije:** isključivo testni preview  
**Produkcija:** nije obuhvaćena i ne smije se mijenjati bez posebnog izričitog odobrenja.

## 1. Svrha
Napraviti jedinstven, kompletan administratorski panel za upravljanje sadržajem, zajednicom, chatom, objavama, analitikom, statistikom i administratorskim pravima. Postojeća stranica arhive chata nije kompletan admin panel i treba je uklopiti u jedinstvenu administratorsku cjelinu.

## 2. Administratorska ovlašćenja
- Vlasnik projekta je glavni administrator i ima sva administratorska ovlašćenja.
- Glavni administrator ima pristup svim funkcijama, podacima i podešavanjima koja panel nudi.
- Ako se kasnije dodaju drugi administratori ili moderatori, glavni administrator im dodjeljuje samo izričito odabrana prava.
- Buduće uloge i dozvole moraju podržati ograničavanje pristupa po funkcionalnim cjelinama i vrstama radnji.
- Sve privilegovane radnje moraju biti provjerene na serveru; skrivanje dugmeta u interfejsu nije sigurnosna kontrola.

## 3. Cjeline administratorskog panela

### 3.1. Kontrolna tabla
Početni pregled stanja sajta sa sažetkom važnih pokazatelja, novim prijavama, sadržajem koji čeka obradu i aktivnošću zajednice. Prikaz mora omogućiti brz prelazak u odgovarajuću cjelinu.

### 3.2. Upravljanje ispovijestima
Pregled i pretraga ispovijesti, pregled pojedinačne ispovijesti, status objave, uklanjanje i vraćanje sadržaja, pregled datuma i relevantnih prijava. Ne brisati trajno sadržaj ako postojeća pravila predviđaju status uklonjenog sadržaja ili mogućnost vraćanja.

### 3.3. Upravljanje komentarima i odgovorima
Pregled komentara i odgovora, pronalaženje po sadržaju/ispovijesti, pregled konteksta, uklanjanje i vraćanje kada je podržano, te povezane prijave i evidencija radnji.

### 3.4. Prijave sadržaja
Jedinstven pregled prijava ispovijesti, komentara, odgovora i chat poruka gdje je podržano. Prikaz razloga, vremena, prijavljenog sadržaja i statusa obrade. Administrator može pregledati prijavu i preduzeti odgovarajuću moderatorsku radnju. Ne uvoditi automatsko kažnjavanje samo na osnovu prijave.

### 3.5. Chat
Uključiti postojeću arhivu chata u jedinstveni panel. Omogućiti pregled istorije, starijih poruka, uklonjenih poruka i prijava, kao i postojeće moderatorske radnje koje backend podržava. Javni prikaz ostaje ograničen na posljednjih 100 poruka; starije poruke ostaju sačuvane u administratorskoj arhivi. Funkcije zabrane pristupa i uklanjanja/vraćanja moraju biti zaštićene serverskom autorizacijom i evidentirane.

### 3.6. Statistika
Prikaz svih raspoloživih mjerljivih pokazatelja, bez proizvoljnog ograničavanja na nekoliko odabranih brojeva. Najmanje obuhvatiti:
- ukupan broj ispovijesti, objavljenih, na čekanju i uklonjenih;
- ukupan broj komentara i odgovora, odvojeno;
- ukupan broj reakcija, odvojeno od komentara i odgovora;
- broj prijava, razvrstan po tipu i statusu gdje podaci postoje;
- aktivnost chata i broj poruka;
- posjete i nove posjetioce, samo ako postoji pouzdan izvor podataka;
- trendove po danu, sedmici, mjesecu i ukupno, gdje podaci i obim čuvanja to omogućavaju.

Svaki pokazatelj mora imati jasno objašnjenje šta broji i iz kog izvora dolazi. Ne prikazivati izmišljene ili procijenjene vrijednosti kao stvarne podatke.

### 3.7. Anonimna analitika posjetilaca
Pratiti zadržavanje posjetilaca nakon 10, 20 i 30 dana, u skladu sa ranije dogovorenim anonimnim modelom. Ne uvoditi prikupljanje identiteta ili nepotrebnih ličnih podataka. Prije implementacije provjeriti koje događaje i identifikatore postojeći sistem zaista bilježi i koliko je mjerenje pouzdano.

### 3.8. Evidencija administratorskih radnji
Evidentirati ko je izvršio radnju, šta je urađeno, nad kojim sadržajem/objektom, kada i razlog ako je unesen. Obuhvatiti relevantne radnje poput uklanjanja i vraćanja sadržaja, moderacije chata, promjene statusa i izmjena podešavanja. Evidencija je korisna i kada postoji samo jedan administrator, jer omogućava pregled promjena i naknadnu provjeru. Evidencija treba biti zaštićena od izmjena kroz obični administratorski interfejs.

### 3.9. Red objava i raspored objavljivanja
Pregled sadržaja na čekanju, statusa reda, mogućnosti pauziranja i nastavka automatskog objavljivanja, te pregled vremena objave i stanja reda. Prije izlaganja svake kontrole provjeriti postojeću serversku logiku i pravila objavljivanja.

## 4. Dizajn i upotrebljivost
- Zadržati postojeći crno-zlatni vizuelni identitet Ispovesti.ba.
- Ne raditi redizajn javnog sajta zbog administratorskog panela.
- Panel treba biti pregledan i upotrebljiv na telefonu i računaru.
- Osjetljive radnje moraju imati jasnu potvrdu i prikaz rezultata.
- Pretragu, filtriranje, sortiranje i strančenje koristiti gdje je potrebno; ne učitavati neograničene istorije odjednom.

## 5. Sigurnost i zaštita podataka
- Administratorska autentifikacija i dodatna provjera identiteta moraju ostati na serverskoj strani.
- Svaki administratorski API zahtjev mora provjeriti nalog, sesiju, ovlašćenje i dozvoljenu radnju.
- Ne izlagati service-role ključeve ili privilegovane podatke u browseru.
- Ne oslanjati se na klijentsko skrivanje funkcija kao zaštitu.
- Sve administratorske radnje moraju biti ograničene na odgovarajuće testne šeme i testne Edge Functions dok se testiranje ne završi.
- Podaci posjetilaca ostaju anonimni; statistika i analitika ne smiju nepotrebno povezivati identitet sa sadržajem.

## 6. Pravila implementacije i puštanja
1. Prije svake izmjene pregledati stvarni kod, postojeće Edge Functions, SQL funkcije, tabele, RLS pravila i postojeće administratorske tokove.
2. Ne duplirati postojeće funkcije; proširiti postojeće sigurne mehanizme gdje je to ispravno.
3. Sve izmjene prvo raditi na testnom preview repozitorijumu i testnim backend šemama.
4. Svaku cjelinu testirati funkcionalno i sigurnosno, uključujući pokušaje neovlašćenog pristupa.
5. Produkcija ostaje netaknuta dok glavni administrator izričito ne odobri zasebno puštanje.
6. Ne mijenjati Premium SMS, naplatu ili druge nepovezane funkcije u okviru ove verzije.

## 7. Trenutno poznato stanje
- U testnom preview repozitorijumu već postoji zasebna stranica chat-admin.html za prijavu i pregled administratorske arhive chata.
- Chat backend već izlaže administratorske radnje za pregled profila, arhive, uklanjanje/vraćanje poruka, zabrane i druge postojeće moderatorske funkcije.
- Community test backend već ima administratorsku autentifikaciju/e-mail provjeru i tabele za sadržaj, prijave, administratore, audit log, red objavljivanja i reakcije.
- Ovo ne znači da kompletan objedinjeni admin panel već postoji. Svaka potrebna radnja i statistika mora se provjeriti prema stvarnim SQL/RPC definicijama i podacima prije povezivanja u UI.
- Posjete i anonimna analitika ne smiju se predstavljati kao dostupne dok se ne potvrdi izvor podataka.

## 8. Šta ova verzija ne odobrava
Ovaj dokument zaključava dogovoreni obim i pravila budućeg administratorskog panela. Sam po sebi ne predstavlja odobrenje za:
- izmjene produkcijskog sajta ili produkcijske baze;
- promjene Auth naloga, administratorskih e-mail adresa ili sigurnosnih faktora;
- promjene Premium SMS/naplate;
- brisanje podataka ili izmjene postojećih pravila čuvanja;
- puštanje bilo koje nove funkcije na produkciju.

**Kraj specifikacije v1.0 — zaključana osnova.**
