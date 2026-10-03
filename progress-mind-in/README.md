# Progress MIND:IN

Strumento interno per gestire le attività settimanali dell'agenzia: clienti, progetti, numero lavoro, milestone con commenti di stato, team, consegne e Gantt. Interfaccia responsive (desktop, tablet, mobile) e installabile come app (PWA).

Zero dipendenze: serve solo Node.js >= 18. I dati sono in un unico file `db.json` (con backup giornaliero automatico).

## Avvio

```bash
npm start                # http://localhost:3000
```

Variabili d'ambiente: `PORT` (3000), `DATA_DIR` (./data), `APP_PASSWORD` (password condivisa opzionale, nome utente qualsiasi).

## Installazione sui vostri server (Docker)

```bash
docker compose up -d --build
```

I dati vivono nel volume `progress-data`. Mettete l'app dietro HTTPS (nginx/Caddy): serve perché browser e tablet permettano "Installa app" e per proteggere la password.

## Uso

- Pulsante **+ Nuovo progetto** sempre visibile in basso a destra.
- **Settimana**: scadenze per giorno, ritardi, filtro per persona.
- **Progetti**: schede con avanzamento; aprendone una trovate note, Gantt, milestone da spuntare e commenti di stato.
- **Timeline**: Gantt di tutti i progetti.
- **Team**: persone e carico di lavoro.

Backup: copiare `DATA_DIR`.
