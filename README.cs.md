![OvěřTo.AI](public/brand/wordmark.svg)

# OvěřTo.AI

Experimentální český pomocník pro posouzení podezřelých SMS, e-mailů a žádostí. Pomáhá najít možné varovné znaky a navrhuje nezávislé ověření. Neověřuje totožnost odesílatele, neotevírá odkazy a nezaručuje bezpečnost.

[English README](README.md) · [Místní dokumentace](http://127.0.0.1:3005/docs) · [Dokumentace API](docs/api/v1.md) · [Soukromí](PRIVACY.md) · [Bezpečnost](SECURITY.md) · [Stav vývoje](docs/development/IMPLEMENTATION-STATUS.md)

## Spuštění

Potřebujete Node.js 22 nebo novější a npm.

```sh
npm ci
npm run dev -- -p 3005
```

Otevřete [http://127.0.0.1:3005](http://127.0.0.1:3005). Bez nastavení AI fungují pravidla. Volitelná integrace s OpenAI-kompatibilním API vyžaduje konfiguraci serveru a výslovný souhlas uživatele. Při nedostupnosti modelu se vrátí výsledek pravidel; aktuální stav je uveden ve výsledku. Omezené živé testy už proběhly, ale nejde o nezávislou reprezentativní evaluaci.

Prohlížeč i server se pokoušejí odstranit některé citlivé údaje, ale nemusí najít všechny. Před odesláním text zkontrolujte. Pokud povolíte AI, nakonfigurovaná služba a případný další poskytovatel modelu mohou dostat údaje, které v textu zůstanou.

## API a bezpečnost

Anonymní místní volání nepotřebuje klíč a nespotřebovává kredity:

```sh
curl http://127.0.0.1:3005/api/v1/analyses \
  -H 'Content-Type: application/json' \
  --data '{"text":"Podezřelá zpráva", "enableLlm":false}'
```

Testovací API klíče a kredity jsou dostupné jen v nakonfigurovaném místním účtu. Klíče mají rozsah oprávnění, expiraci, denní limit a možnost výměny. Rozhraní není připraveno pro veřejný provoz: omezení v jednom procesu nenahrazuje distribuované limity pro anonymní návštěvníky, produkční přihlášení ani rozpočty poskytovatele. Podrobnosti a příklad s klíčem jsou v [dokumentaci API](docs/api/v1.md).

Místní e-mailová schránka zachytává testovací zprávy a neodesílá skutečné e-maily. Stripe Test Mode je experimentální a ve výchozím nastavení vypnutý. Skutečný testovací Checkout, podepsané webhooky, jednorázové připsání kreditů, portál i zrušení předplatného byly ověřeny; obnovení, selhání plateb a úplné odsouhlasení ještě ne. Produkční účty ani platby nejsou dostupné. [Záznam ověření](docs/saas/stripe-live-test.md).

Projekt je poskytován pod [Apache-2.0](LICENSE); závislosti mají vlastní licence. Příspěvky popisuje [CONTRIBUTING.md](CONTRIBUTING.md).

## Rozhraní a správa

Domovská stránka, analýza včetně doporučení, přihlášení, obnova hesla, ceník a vývojářská stránka mají české a anglické texty. Jazyk se volí podle prohlížeče; ruční volba má přednost. Citace původních zpráv se nepřekládají. Témata Světlé / Tmavé / Systém se ukládají. Pracovní prostor a fakturace ještě nejsou kompletně přeloženy.

Správce platformy může změnit název, lokální logo, barvu, popisy a oznámení. Uložení kontroluje oprávnění, verzi a vytváří auditní záznam. Prvního správce přiřazuje důvěryhodné místní CLI, nikoli veřejná registrace. [Přehled provozu](docs/administration/operations.md) nyní zobrazuje skutečné místní účty, testovací předplatná, audit a základní stav systému. Produkční správa účtů a plateb ještě není hotová. [Postup nastavení](docs/administration/site-settings.md).

AI Studio zobrazuje metadata volání a jejich stav, dobu a tokeny. Chybějící cenu neoznačuje jako nulovou. Neuchovává celé zprávy; verze administračních instrukcí jsou uloženy jako konfigurace. Prompt Lab podporuje neměnné verze, syntetické testy a řízenou aktivaci. Evaluace spouští autorskou sadu pravidly a omezené AI testy se souhlasem. [Dokumentace záznamů](docs/administration/ai-traces.md).

Přihlášené místní požadavky nově sdílejí limity PostgreSQL podle klíče, projektu a prostoru. Nejde o kompletní ochranu veřejného SaaS. Produkční placená AI zůstává blokovaná. [Sdílené limity](docs/administration/shared-limits.md).

![OvěřTo.AI — česká mobilní úvodní stránka v tmavém tématu](assets/screenshots/v7-home-cs-dark-390.png)

Snímky zobrazují místní aplikaci se syntetickým obsahem. Další záběry [dashboardu](assets/screenshots/v7-dashboard-cs-1440.png), [API klíčů](assets/screenshots/v7-api-keys-cs-1440.png), [Playgroundu](assets/screenshots/v7-playground-cs-1440.png) a [dokumentace](assets/screenshots/v7-docs-en-1024.png) jsou z reálného prohlížeče. [Vizuální revize](docs/design/FINAL-VISUAL-REVIEW.md) uvádí zjištění a zbývající práci. [Značka a vlastní hosting](BRANDING.md).
