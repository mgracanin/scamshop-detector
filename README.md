<p align="center">
  <img src="icons/icon512.png" alt="ScamShop Detector Logo" width="128" height="128" />
</p>

<h1 align="center">ScamShop Detector</h1>

<p align="center">
  <strong>Proširenje za preglednike temeljene na Chromiumu za provjeru internetskih trgovina u bazi servisa CERT iffy na zahtjev korisnika.</strong>
</p>

<p align="center">
  <a href="https://github.com/mgracanin/scamshop-detector/releases/latest"><img src="https://img.shields.io/github/v/release/mgracanin/scamshop-detector?color=1a73e8&label=Zadnje%20izdanje&logo=github" alt="Zadnje izdanje"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-success?logo=googlechrome&logoColor=white" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Preglednici-Chrome%20%7C%20Edge%20%7C%20Brave%20%7C%20Opera-orange" alt="Preglednici">
  <a href="LICENSE"><img src="https://img.shields.io/badge/Licenca-MIT-blue.svg" alt="Licenca MIT"></a>
</p>

---

## 📦 Preuzimanja (Releases)

Najnovija stabilna verzija proširenja dostupna je za izravno preuzimanje:

| Verzija | Datum | Poveznica za preuzimanje | Bilješke izdanja |
| :--- | :--- | :--- | :--- |
| **v1.1.0 (Najnovije)** | 18.10.2026. | [⬇️ **scamshop-detector-v1.1.0.zip**](https://github.com/mgracanin/scamshop-detector/releases/download/v1.1.0/scamshop-detector-v1.1.0.zip) | [Pregledaj izmjene v1.1.0](https://github.com/mgracanin/scamshop-detector/releases/tag/v1.1.0) |
| **v1.0.0** | 06.09.2026. | [⬇️ iffy-checker-v1.0.0.zip](https://github.com/mgracanin/scamshop-detector/releases/tag/v1.0.0) | Početna verzija |

> 🚀 **Sva izdanja i povijest promjena**: Posjetite stranicu **[GitHub Releases](https://github.com/mgracanin/scamshop-detector/releases)** za popis svih dostupnih verzija i priloženih arhiva.

---

> [!IMPORTANT]
> **Važna pravna napomena i odricanje odgovornosti (Disclaimer):**  
> Ovo proširenje je **neovisan projekt otvorenog koda**. Proširenje **nije razvio, ne održava niti je u vlasništvu Hrvatske akademske i istraživačke mreže – CARNET ili Nacionalnog CERT-a**.  
> Autor, izdavač i osoba odgovorna za održavanje proširenja je **Matija Gračanin**.  
> Proširenje se za provjeru podataka oslanja na javno dostupan servis [CERT iffy](https://iffy.cert.hr/).

---

## 📑 Sadržaj

- [O projektu](#-o-projektu)
- [Kako funkcionira provjera](#-kako-funkcionira-provjera)
- [Značenje oznaka i bedževa](#-značenje-oznaka-i-bedževa)
- [Mogućnosti](#-mogućnosti)
- [Instalacija](#-instalacija)
  - [Metoda 1: Preko preuzete ZIP arhive (Preporučeno)](#metoda-1-preko-preuzete-zip-arhive-preporučeno)
  - [Metoda 2: Kloniranjem repozitorija (Za programere)](#metoda-2-kloniranjem-repozitorija-za-programere)
- [Privatnost i sigurnost](#-privatnost-i-sigurnost)
- [Često postavljana pitanja (FAQ)](#-često-postavljana-pitanja-faq)
- [Struktura projekta](#-struktura-projekta)
- [Doprinos i prijava poteškoća](#-doprinos-i-prijava-poteškoća)
- [Licenca i autorstvo](#-licenca-i-autorstvo)

---

## 🔍 O projektu

**ScamShop Detector** je dodatak za preglednike Chromium arhitekture (Google Chrome, Microsoft Edge, Brave, Opera, Vivaldi) stvoren s ciljem jednostavnije i brže provjere internetskih trgovina u bazi servisa **CERT iffy**, koji razvija i održava **Nacionalni CERT** (odjel CARNET-a).

Lažne internetske trgovine u pravilu oponašaju poznate robne marke (odjeću, obuću, elektroniku), a kreirane su s ciljem neovlaštenog prikupljanja podataka bankovnih kartica i krađe novca građana. Ovo proširenje omogućuje provjeru domene jednim klikom prije unošenja bilo kakvih povjerljivih podataka.

---

## ⚙️ Kako funkcionira provjera

1. **Provjera isključivo na vaš zahtjev (On-Demand provjera klikom)**:  
   Kako se ne bi preopteretili poslužitelji servisa CERT iffy, provjera domena nije automatska, nego se pokreće isključivo kada korisnik klikne na gumb *"Provjeri ovu domenu"*, unese adresu ručno ili se odabere provjera desnim klikom miša.

2. **Provjera u bazi prethodno detektiranih trgovina**:  
   Servis CERT iffy u trenutku unosa domene **ne provodi dubinsku analizu stranice u stvarnom vremenu**, već provjerava nalazi li se unesena domena na popisu internetskih trgovina koje je Nacionalni CERT **već ranije detektirao i označio kao lažne**.

3. **Nema jamstva apsolutne sigurnosti**:  
   Ako sustav ne pronađe domenu u bazi, to **ne znači da je stranica automatski sigurna**. Moguće je da se radi o novoj lažnoj trgovini koja još nije prijavljena ili obrađena. Sustav CERT iffy služi kao koristan alat za donošenje što informiranije odluke, no konačnu odluku donosi kupac. Prije svake kupovine preporučuje se proučiti službene [Dodatne savjete za sigurnu kupovinu](https://iffy.cert.hr/tips).

---

## 🏷️ Značenje oznaka i bedževa

Prilikom provjere, proširenje prikazuje bedž na ikoni u alatnoj traci i detaljnu karticu u skočnom prozoru:

| Bedž | Boja | Status | Značenje i preporučena radnja |
| :---: | :---: | :--- | :--- |
| **`INF`** | Zelena | **Nije u bazi lažnih trgovina** | Domena se ne nalazi na popisu lažnih trgovina koje je CERT prethodno zabilježio. Prikazuje se nakon klika na provjeru. *Ovo nije garancija apsolutne sigurnosti.* Prije unosa kartice uvijek proučite [Dodatne savjete](https://iffy.cert.hr/tips). |
| **`WRN`** | Crvena | **Upozorenje: Obilježja lažne trgovine!** | Domena ima obilježja lažne trgovine u bazi servisa CERT iffy. **Izbjegavajte unos osobnih podataka i brojeva kartica.** |
| **`WHT`** | Plava | **Dopuštena domena (Whitelist)** | Domena se nalazi na vašem korisničkom popisu pouzdanih adresa (npr. vaša banka ili poznata trgovina). Prikazuje se automatski pri posjetu stranici. |
| **`ERR`** | Neutralna | **Pogreška pri provjeri** | Servis CERT iffy trenutačno nije dostupan ili unesena adresa nije ispravnog oblika. |

---

## ✨ Mogućnosti

- 🎯 **Provjera aktivne kartice jednim klikom**: Čim otvorite skočni prozor proširenja, kliknite na gumb *"Provjeri ovu domenu"* za trenutačnu usporedbu s bazom.
- 🖱️ **Kontekstni izbornik (Desni klik)**: Kliknite desnom tipkom miša na bilo koju poveznicu ili otvorenu stranicu i odaberite *"Provjeri domenu sa servisom CERT iffy"* bez potrebe za otvaranjem stranice.
- 🔎 **Ručna provjera**: Tražilica unutar skočnog prozora omogućuje upisivanje i testiranje bilo koje adrese (npr. sumnjivi link iz e-pošte ili SMS-a).
- ⭐ **Popis pouzdanih adresa (Whitelist)**: Pohranite provjerene trgovine i institucije na svoj popis dopuštenih kako biste ih odmah prepoznali. Popis automatski pokriva i pripadajuće poddomene.
- 🕒 **Lokalna evidencija i statistika**: Pratite povijest svojih provjera i osnovne brojače (provjereno, nije u bazi, upozorenja).
- 💡 **Izravna poveznica na CERT savjete**: Jedan klik dijeli vas od službenih preporuka o provjeri domena, načina plaćanja i znakova prevare.

---

## 📥 Instalacija

### Metoda 1: Preko preuzete ZIP arhive (Preporučeno)

1. Preuzmite najnoviju arhivu **[scamshop-detector-v1.1.0.zip](https://github.com/mgracanin/scamshop-detector/releases/download/v1.1.0/scamshop-detector-v1.1.0.zip)** iz sekcije [Releases](https://github.com/mgracanin/scamshop-detector/releases).
2. Raspakirajte (unzip) preuzetu arhivu u mapu na računalu (npr. u `Dokumenti\scamshop-detector`).
3. Otvorite Google Chrome (ili Brave, Edge, Opera) i u adresnu traku upišite:
   ```text
   chrome://extensions
   ```
4. U gornjem desnom kutu uključite prekidač **Developer mode** (Način rada za razvojne programere).
5. U gornjem lijevom kutu kliknite gumb **Load unpacked** (Učitaj raspakirano).
6. Odaberite mapu u koju ste raspakirali datoteke.
7. Ikona **ScamShop Detector** pojavit će se u traci proširenja! Preporučujemo da je prikvačite (pin) radi lakšeg pristupa.

---

### Metoda 2: Kloniranjem repozitorija (Za programere)

1. Klonirajte repozitorij putem Git terminala:
   ```bash
   git clone https://github.com/mgracanin/scamshop-detector.git
   ```
2. Otvorite `chrome://extensions` u pregledniku.
3. Omogućite **Developer mode**.
4. Kliknite **Load unpacked** i odaberite kloniranu mapu projekta.

---

## 🔒 Privatnost i sigurnost

Proširenje je u potpunosti usmjereno na zaštitu privatnosti korisnika:

- **Šalje se isključivo naziv domene**: Prije slanja upita servisu CERT iffy, adresa se čisti od svih parametara. Primjerice, ako posjetite `https://trgovina.hr/proizvod?id=123&session=token`, servisu se šalje **isključivo** očišćeni naziv domene: `trgovina.hr`.
- **Bez praćenja i analitike**: Proširenje ne sadrži vanjske skripte za praćenje (Google Analytics i sl.), ne pristupa kolačićima korisnika i ne sprema osobne podatke.
- **Lokalna pohrana podataka**: Povijest provjera i vaš popis pouzdanih domena čuvaju se isključivo na vašem računalu putem standardnog `chrome.storage.local` API-ja.
- **Predmemoriranje (Cache)**: Rezultati se privremeno pamte 10 minuta kako bi se spriječilo ponavljanje istih upita i nepotrebno opterećivanje poslužitelja CERT-a.

---

## ❓ Često postavljana pitanja (FAQ)

<details>
<summary><strong>Zašto proširenje ne provjerava svaku stranicu automatski u pozadini?</strong></summary>
<p>
Kako se ne bi preopteretili poslužitelji servisa CERT iffy, provjera domena nije automatska, nego se pokreće isključivo kada korisnik klikne na gumb za provjeru, unese adresu ručno ili odabere provjeru desnim klikom miša.
</p>
</details>

<details>
<summary><strong>Znači li poruka "Nije u bazi lažnih trgovina" da je stranica 100% sigurna?</strong></summary>
<p>
Ne. To znači samo da domena u tom trenutku nije evidentirana u CERT-ovoj bazi ranije prepoznatih lažnih trgovina. Trgovina može biti potpuno nova i još neprijavljena. Uvijek obratite pozornost na cijene koje djeluju nerealno nisko, način plaćanja i službene <a href="https://iffy.cert.hr/tips">Dodatne savjete</a>.
</p>
</details>

<details>
<summary><strong>Radi li proširenje na mobilnim telefonima?</strong></summary>
<p>
Standardni mobilni Google Chrome na Androidu i iOS-u ne podržava proširenja. Međutim, proširenje možete instalirati na mobilnim preglednicima koji podržavaju proširenja temeljena na Chromiumu (npr. Kiwi Browser ili Orion na iOS-u).
</p>
</details>

<details>
<summary><strong>Što učiniti ako primijetim lažnu trgovinu koja nije u bazi?</strong></summary>
<p>
Svaku sumnjivu trgovinu možete izravno prijaviti Nacionalnom CERT-u putem obrasca na <a href="https://iffy.cert.hr/">iffy.cert.hr</a> ili slanjem obavijesti na <a href="https://www.cert.hr/onama/kontakt/">cert.hr/onama/kontakt</a>.
</p>
</details>

---

## 📁 Struktura projekta

```text
scamshop-detector/
├── manifest.json         # Manifest V3 specifikacija i dozvole
├── service_worker.js     # Pozadinski radnik (upiti prema CERT API-ju, predmemorija, ikone)
├── popup/
│   ├── popup.html        # Glavno sučelje skočnog prozora (Provjera, Povijest, Postavke)
│   ├── popup.css         # Google Material 3 stilovi (podrška za svijetlu i tamnu temu)
│   ├── popup.js          # Interaktivna logika sučelja (provjera na zahtjev)
│   └── about.html        # Detaljne informacije, upute, pravne napomene i objašnjenja
├── icons/
│   ├── icon.svg          # Vektorska ikona (SVG)
│   ├── icon16.png        # Ikona 16x16 px
│   ├── icon32.png        # Ikona 32x32 px
│   ├── icon48.png        # Ikona 48x48 px
│   ├── icon128.png       # Ikona 128x128 px
│   ├── icon256.png       # Ikona 256x256 px
│   └── icon512.png       # Ikona 512x512 px (visoka razlučivost)
├── LICENSE               # MIT licenca otvorenog koda
└── README.md             # Dokumentacija projekta
```

---

## 🤝 Doprinos i prijava poteškoća

Prijedlozi za poboljšanje i doprinosi kodu su dobrodošli! Ako uočite tehničku grešku ili imate ideju za novu funkcionalnost, otvorite [novi Issue na GitHubu](https://github.com/mgracanin/scamshop-detector/issues).

---

## 📜 Licenca i autorstvo

- **Autor i održavatelj projekta**: **Matija Gračanin** ([matijag@gmail.com](mailto:matijag@gmail.com))
- **Licenca**: Projekt je objavljen pod otvorenom licencom **[MIT License](LICENSE)**.
- **Izvor podataka**: Podaci o lažnim trgovinama preuzimaju se putem javno dostupnog servisa **[CERT iffy](https://iffy.cert.hr/)** koji razvija **Nacionalni CERT / CARNET**.
- **Službeni savjeti za sigurnu kupovinu**: **[iffy.cert.hr/tips](https://iffy.cert.hr/tips)**
