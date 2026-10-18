# ScamShop Detector (Chrome Extension)

**ScamShop Detector** is a Google Chrome (Manifest V3) extension that enables users to check web shops against the official **CERT iffy** database ([iffy.cert.hr](https://iffy.cert.hr/)) on demand, helping protect against fraudulent online stores and phishing scams.

> **Važna napomena / Disclaimer:**  
> Ovo proširenje je **neovisan projekt otvorenog koda**. Proširenje **nije razvio, ne održava niti je u vlasništvu Hrvatske akademske i istraživačke mreže – CARNET ili Nacionalnog CERT-a**.  
> Autor i održavatelj proširenja: **Matija Gračanin**.  
> Proširenje se oslanja na javno dostupan servis [CERT iffy](https://iffy.cert.hr/).

---

## Kako funkcionira provjera

1. **Provjera isključivo na zahtjev (On-Demand)**:  
   Prema preporuci Nacionalnog CERT-a, proširenje **ne skenira automatski svaku posjećenu stranicu** kako bi se spriječilo preopterećenje poslužitelja i omogućila nesmetana noćna obrada prijava lažnih trgovina. Provjera se pokreće isključivo kada korisnik klikne na gumb *"Provjeri ovu domenu"*, unese domenu ručno ili odabere provjeru desnim klikom miša.

2. **Provjera u bazi prethodno detektiranih trgovina**:  
   Servis CERT iffy u trenutku unosa domene **ne analizira obilježja stranice u stvarnom vremenu**, već provjerava nalazi li se domena na popisu trgovina koje je Nacionalni CERT već ranije detektirao kao lažne.  
   Ako domena nije u bazi, to **ne jamči apsolutnu sigurnost stranice**. Servis služi kao pomoćni alat za informirano donošenje odluka, a korisnik odluku donosi na vlastitu odgovornost. Prije svake kupovine preporučuje se provjeriti službene [Dodatne savjete za sigurnu kupovinu](https://iffy.cert.hr/tips).

---

## Oznake statusa (Bedževi)

- **`INF`** (Plava/Siva): Domena nije prepoznata kao lažna trgovina u bazi servisa CERT iffy. Prije kupovine provjerite [Dodatne savjete](https://iffy.cert.hr/tips).
- **`WRN`** (Crvena): Upozorenje! Poveznica ima obilježja lažne internetske trgovine u bazi servisa CERT iffy.
- **`WHT`** (Plava): Domena se nalazi na vašem korisničkom popisu pouzdanih adresa (Whitelist).
- **`ERR`** (Siva): Servis CERT iffy trenutačno nije dostupan ili je unesena nevaljana adresa.

---

## Mogućnosti

- **Provjera jednim klikom**: Provjerite aktivnu karticu jednim klikom na gumb unutar skočnog prozora proširenja.
- **Kontekstni izbornik (Desni klik)**: Kliknite desnom tipkom miša na bilo koju poveznicu ili stranicu i odaberite *"Provjeri domenu sa servisom CERT iffy"*.
- **Ručni unos**: Unesite bilo koju domenu u tražilicu unutar proširenja prije nego što posjetite stranicu.
- **Popis pouzdanih adresa (Whitelist)**: Dodajte vlastite provjerene trgovine i banke u popis pouzdanih domena.
- **Privatnost na prvom mjestu**: Servisu se šalje isključivo naziv domene (npr. `trgovina.hr`). Puni URL-ovi, parametri, korisnički tokeni i osobni podaci nikada se ne šalju.
- **Lokalna pohrana**: Povijest provjera i statistika spremaju se isključivo lokalno na računalu korisnika.

---

## Instalacija (Developer Mode)

1. Preuzmite ili klonirajte repozitorij na svoje računalo:
   ```bash
   git clone https://github.com/mgracanin/iffy-checker.git
   ```
2. Otvorite Google Chrome (ili Brave, Edge, Opera) i posjetite:
   ```text
   chrome://extensions
   ```
3. U gornjem desnom kutu omogućite **Developer mode** (Način rada za razvojne programere).
4. Kliknite **Load unpacked** (Učitaj raspakirano) u gornjem lijevom kutu.
5. Odaberite mapu ovog projekta.
6. Ikona **ScamShop Detector** pojavit će se na traci proširenja!

---

## Struktura projekta

```text
├── manifest.json         # Manifest V3 konfiguracija proširenja
├── service_worker.js     # Pozadinski radnik (upiti prema API-ju, predmemorija, bedževi)
├── popup/
│   ├── popup.html        # Sučelje skočnog prozora (Provjera, Povijest, Postavke)
│   ├── popup.css         # Moderni Google Material 3 stilovi (svijetla i tamna tema)
│   ├── popup.js          # Logika sučelja na zahtjev korisnika
│   └── about.html        # Detaljne informacije, upute i pravne napomene
├── icons/
│   ├── icon16.png        # Ikona 16x16
│   ├── icon48.png        # Ikona 48x48
│   └── icon128.png       # Ikona 128x128
└── README.md
```

---

## Licenca i autorstvo

- **Autor i održavatelj**: Matija Gračanin
- **Servis za provjeru**: [CERT iffy](https://iffy.cert.hr/) (CARNET / Nacionalni CERT)
- **Službeni savjeti**: [iffy.cert.hr/tips](https://iffy.cert.hr/tips)
