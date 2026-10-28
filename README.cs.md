# OvěřTo.AI

Experimentální český pomocník pro posouzení podezřelých SMS, e-mailů a žádostí. Pomáhá najít možné varovné znaky a navrhuje nezávislé ověření. Neověřuje totožnost odesílatele, neotevírá odkazy a nezaručuje bezpečnost.

[English README](README.md) · [Dokumentace API](docs/api/v1.md) · [Soukromí](PRIVACY.md) · [Bezpečnost](SECURITY.md) · [Stav vývoje](docs/development/IMPLEMENTATION-STATUS.md)

## Spuštění

Potřebujete Node.js 22 nebo novější a npm.

```sh
npm ci
npm run dev -- -p 3005
```

Otevřete [http://127.0.0.1:3005](http://127.0.0.1:3005). Bez nastavení AI fungují pravidla. Volitelná integrace OpenLux vyžaduje konfiguraci serveru a výslovný souhlas uživatele. Při nedostupnosti modelu se vrátí výsledek pravidel; aktuální stav je uveden ve výsledku. Omezené živé testy už proběhly, ale nejde o nezávislou reprezentativní evaluaci.

Prohlížeč i server se pokoušejí odstranit některé citlivé údaje, ale nemusí najít všechny. Před odesláním text zkontrolujte. Pokud povolíte AI, služba OpenLux a její poskytovatel modelu mohou dostat údaje, které v textu zůstanou.

## API a bezpečnost

Anonymní místní volání nepotřebuje klíč a nespotřebovává kredity:

```sh
curl http://127.0.0.1:3005/api/v1/analyses \
  -H 'Content-Type: application/json' \
  --data '{"text":"Podezřelá zpráva", "enableLlm":false}'
```

Testovací API klíče a kredity jsou dostupné jen v nakonfigurovaném místním účtu. Rozhraní není připraveno pro veřejný provoz: omezení v jednom procesu nenahrazuje distribuované limity, produkční přihlášení ani rozpočty poskytovatele. Podrobnosti a příklad s klíčem jsou v [dokumentaci API](docs/api/v1.md).

Místní e-mailová schránka zachytává testovací zprávy a neodesílá skutečné e-maily. Stripe Test Mode je experimentální, ve výchozím nastavení vypnutý a dosud nebyl ověřen skutečným testovacím průchodem. Produkční účty ani platby nejsou dostupné.

Projekt je poskytován pod [Apache-2.0](LICENSE); závislosti mají vlastní licence. Příspěvky popisuje [CONTRIBUTING.md](CONTRIBUTING.md).
