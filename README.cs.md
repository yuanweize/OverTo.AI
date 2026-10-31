![OvěřTo.AI](public/brand/wordmark.svg)

# OvěřTo.AI

Experimentální český pomocník pro posouzení podezřelých SMS, e-mailů a žádostí. Pomáhá najít možné varovné znaky a navrhuje nezávislé ověření. Neověřuje totožnost odesílatele, neotevírá odkazy a nezaručuje bezpečnost.

[English README](README.md) · [Dokumentace API](docs/api/v1.md) · [Průvodce vlastním provozem](docs/deployment/self-host.md) · [Soukromí](PRIVACY.md) · [Bezpečnost](SECURITY.md) · [Stav vývoje](docs/development/IMPLEMENTATION-STATUS.md)

## Spuštění

Potřebujete Node.js 22 nebo novější a npm.

```sh
npm ci
npm run dev -- -p 3005
```

Otevřete [http://127.0.0.1:3005](http://127.0.0.1:3005). Bez nastavení AI fungují pravidla. Volitelná integrace s OpenAI-kompatibilním API vyžaduje konfiguraci serveru a výslovný souhlas uživatele. Při nedostupnosti modelu se vrátí výsledek pravidel; aktuální stav je uveden ve výsledku. Omezené živé testy už proběhly, ale nejde o nezávislou reprezentativní evaluaci.

### Self-Host provoz v Docker Compose

Pro spuštění kompletního stacku s PostgreSQL a migracemi:

```sh
cp .env.selfhost.example .env.selfhost
docker compose --env-file .env.selfhost -f compose.saas.yaml up -d --build
```

#### Přehled portů

| Režim | Aplikace OverTo | Mailpit Web UI | Mailpit SMTP | PostgreSQL |
|---|---|---|---|---|
| **Místní vývoj** (`npm run dev -- -p 3005`) | `http://127.0.0.1:3005` | `http://127.0.0.1:8025` | `127.0.0.1:1025` | `127.0.0.1:55443` |
| **Self-Host Compose** (`compose.saas.yaml`) | `http://127.0.0.1:3006` | `http://127.0.0.1:8026` | `mailpit:1025` | `127.0.0.1:5432` |

Podrobný návod k provozu, zálohování a správě je v [Průvodci vlastním provozem](docs/deployment/self-host.md).

Prohlížeč i server se pokoušejí odstranit některé citlivé údaje, ale nemusí najít všechny. Před odesláním text zkontrolujte. Pokud povolíte AI, nakonfigurovaná služba a případný další poskytovatel modelu mohou dostat údaje, které v textu zůstanou.

## API a bezpečnost

Anonymní místní volání nepotřebuje klíč a nespotřebovává kredity:

```sh
curl http://127.0.0.1:3005/api/v1/analyses \
  -H 'Content-Type: application/json' \
  --data '{"text":"Podezřelá zpráva", "enableLlm":false}'
```

Testovací i produkční API klíče mají rozsah oprávnění, expiraci, denní limit a možnost okamžité výměny (revokace). Ochrana proti podvržení identity návštěvníků a rychlostní limity jsou vynucovány na úrovni Trusted Reverse Proxy s bezpečným fallbackem. Podrobnosti a příklad volání jsou v [dokumentaci API](docs/api/v1.md).

V režimu lokálního vývoje zachytává Mailpit citlivé jednorázové odkazy bez odesílání do reálné sítě. V self-hosted produkci (`compose.saas.yaml`) je plně podporováno reálné doručování přes SMTP. Stripe Test Mode poskytuje ověřený proces: idempotenci webhooků, automatické připsání kreditů, portál pro zákazníky, zrušení předplatného, zpracování selhání i vrácení plateb v PostgreSQL knize. Záznam testů a stav implementace viz [záznam ověření](docs/saas/stripe-live-test.md) a [kreditní kniha](docs/saas/ledger.md).

Projekt je poskytován pod [Apache-2.0](LICENSE); závislosti mají vlastní licence. Příspěvky popisuje [CONTRIBUTING.md](CONTRIBUTING.md).

## Vizuální přehled a galerie rozhraní

### 1. Analýza založená na důkazech a hlavní stránka

<p align="center">
  <img src="assets/screenshots/v7-analyze-cs-1440.png" width="100%" alt="Výsledek analýzy se signály a důkazy" />
  <br />
  <sub><strong>Výsledek analýzy a verdikt (čeština, 1440px Desktop)</strong> — Citace ověřených signálů z textu, skóre rizika a bezpečné kroky nezávislého ověření.</sub>
</p>

| Anglická mobilní analýza v tmavém režimu (390px) | Česká mobilní úvodní stránka v tmavém režimu (390px) |
|:---:|:---:|
| <img src="assets/screenshots/v7-analyze-en-dark-390.png" width="85%" alt="Anglická mobilní analýza v tmavém režimu" /><br /><sub><strong>Analýza zprávy (tmavý mobilní režim)</strong></sub> | <img src="assets/screenshots/v7-home-cs-dark-390.png" width="85%" alt="Česká mobilní úvodní stránka v tmavém režimu" /><br /><sub><strong>Úvodní stránka a zadání textu (tmavý mobilní režim)</strong></sub> |

### 2. Klientský dashboard a vývojářská konzole

<p align="center">
  <img src="assets/screenshots/v7-dashboard-cs-1440.png" width="100%" alt="Klientský dashboard" />
  <br />
  <sub><strong>Klientský dashboard pracovního prostoru (1440px Desktop)</strong> — Přehled spotřeby, zůstatek kreditů a správa projektů.</sub>
</p>

| API klíče a limity spotřeby (1440px Desktop) | Interaktivní API Playground (1440px Desktop) |
|:---:|:---:|
| <img src="assets/screenshots/v7-api-keys-cs-1440.png" width="100%" alt="API klíče a denní limity" /><br /><sub><strong>Správa API klíčů a limitů</strong> — Rozsahy oprávnění, linie tokenů a sdílené limity.</sub> | <img src="assets/screenshots/v7-playground-cs-1440.png" width="100%" alt="Interaktivní API Playground" /><br /><sub><strong>Interaktivní API Playground</strong> — Živé testování požadavků s formátovanou JSON odpovědí.</sub> |

| Vývojářská dokumentace API (1024px Tablet) | Testovací fakturace a portál Stripe (1440px Desktop) |
|:---:|:---:|
| <img src="assets/screenshots/v7-developers-cs-dark-1024-a11y.png" width="100%" alt="Vývojářská dokumentace" /><br /><sub><strong>Dokumentace pro vývojáře (tmavý tablet)</strong> — Přístupná referenční dokumentace API podle WCAG AA.</sub> | <img src="assets/screenshots/v7-billing-cs-1440.png" width="100%" alt="Kreditní kniha a předplatná" /><br /><sub><strong>Kreditní kniha a předplatná</strong> — Atomické připisování kreditů a testovací fakturace.</sub> |

### 3. Správa platformy a AI Studio (pouze ROOT)

<p align="center">
  <img src="assets/screenshots/v7-admin-overview-en-1440.png" width="100%" alt="Přehled správy platformy" />
  <br />
  <sub><strong>Provozní konzole platformy (1440px Desktop)</strong> — Živé metriky nájemců, transakční auditní záznamy a stav systému.</sub>
</p>

| AI Studio: Záznamy a rozpočty (tmavý režim) | Prompt Lab a správa verzí |
|:---:|:---:|
| <img src="assets/screenshots/v7-ai-studio-en-dark.png" width="100%" alt="AI Studio záznamy" /><br /><sub><strong>Provozní záznamy AI Studia (tmavý režim)</strong> — Skutečné využití tokenů, latence a atomické sledování rozpočtu.</sub> | <img src="assets/screenshots/v7-prompt-lab.png" width="100%" alt="Prompt Lab" /><br /><sub><strong>Prompt Lab a verzování systémových instrukcí</strong> — Neměnné verze promptů, testování a auditovaný návrat k předchozí verzi.</sub> |

<details>
<summary><strong>Zobrazit další snímky rozhraní (mobilní zobrazení, světlý a tmavý režim)</strong></summary>

| Zobrazení | Náhled rozhraní |
|---|---|
| Český ceník (1440px Desktop) | <img src="assets/screenshots/v7-pricing-cs-1440.png" width="100%" alt="Ceník Desktop" /><br /><sub><strong>Ceník (čeština, 1440px)</strong></sub> |
| Anglická dokumentace (1024px Desktop) | <img src="assets/screenshots/v7-docs-en-1024.png" width="100%" alt="Dokumentace Desktop" /><br /><sub><strong>Dokumentace (angličtina, 1024px)</strong></sub> |
| Registr modelů a kontrola dostupnosti | <img src="assets/screenshots/v7-model-registry.png" width="100%" alt="Registr modelů" /><br /><sub><strong>Registr AI poskytovatelů a ověření spojení</strong></sub> |
| Tabulka uživatelů a vyhledávání identit | <img src="assets/screenshots/v7-admin-users-en-1440.png" width="100%" alt="Tabulka administrátorských uživatelů" /><br /><sub><strong>Správa uživatelů platformy a úprava kreditů</strong></sub> |
| Česká fakturace (tmavý mobil, 390px) | <img src="assets/screenshots/v7-billing-cs-dark-390.png" width="50%" alt="Fakturace mobil" /><br /><sub><strong>Fakturace a kredity (tmavý mobil)</strong></sub> |
| České API klíče (tmavý mobil, 390px) | <img src="assets/screenshots/v7-api-keys-cs-dark-390.png" width="50%" alt="API klíče mobil" /><br /><sub><strong>API klíče (tmavý mobil)</strong></sub> |
| Český dashboard (tmavý mobil, 390px) | <img src="assets/screenshots/v7-dashboard-cs-dark-390.png" width="50%" alt="Dashboard mobil" /><br /><sub><strong>Dashboard (tmavý mobil)</strong></sub> |
| Přehled správce (tmavý mobil, 390px) | <img src="assets/screenshots/v7-admin-overview-en-dark-390.png" width="50%" alt="Správa mobil" /><br /><sub><strong>Provozní správa (tmavý mobil)</strong></sub> |
| AI Studio (světlý desktop) | <img src="assets/screenshots/v7-ai-studio-en-light.png" width="100%" alt="AI Studio světlé" /><br /><sub><strong>AI Studio záznamy (světlý desktop)</strong></sub> |

</details>

Volba jazyka a motivu se trvale ukládá. Veřejné stránky, přihlašovací formuláře a obrazovky účtu mají kompletní české i anglické texty. Viz [tříkolová vizuální revize](docs/design/FINAL-VISUAL-REVIEW.md), [veřejná referenční revize](docs/design/OPENROUTER-REFERENCE-REVIEW.md) a [pravidla značky](BRANDING.md).

## Správa a integrace AI modelů

Nastavte `OPENAI_BASE_URL`, `OPENAI_MODEL` a privátní `OPENAI_API_KEY` v `.env.local` nebo `.env.selfhost`. Adaptér akceptuje endpointy kompatibilní s OpenAI `/v1/chat/completions`. Konkurenční souběhy a limity útraty jsou atomicky chráněny přes `AiBudgetGuard` (`migrations/016_ai_budget_reservations.sql`). Pokud dojde k vyčerpání rozpočtu, volání bezpečně selže a vrátí deterministické vyhodnocení podle pravidel.
