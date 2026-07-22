# LP — Lógica de Programação do Zero (Impacta × Olhar Digital)

Landing page estática do curso **Lógica de Programação** (40h ao vivo, presencial e online), servida por nginx em container via Coolify.

- **Produção:** https://logica.technowhub.ai (canonical: https://www.impacta.com.br/cursos/logica)
- **Infra:** Coolify na VPS Hetzner (`159.69.240.1`) — push na `main` → redeploy automático
- **Healthcheck:** `GET /healthz` → `ok`

## Estrutura
- `index.html` — página única (SEO completo: canonical, OG, JSON-LD Course + FAQ)
- `styles.css` — estilos (tema dark neon, design exportado do canvas)
- `app.js` — captura de UTMs → repassa aos checkouts/WhatsApp, eventos IRIS (`lp_view`, `click_compra`, `click_whats`), Pixel Meta (no-op até ter ID), interações da página
- `assets/` — imagens, vídeo do campus, logos e fontes self-hosted
- `Dockerfile` + `nginx.conf` — nginx:alpine, porta 80, cache 30d em `/assets/`

## Turmas / checkouts (Engaged)
| Turma | Início | Checkout |
|---|---|---|
| Presencial (Av. Paulista) | 14/09/2026 | `.../p/checkout/se22shhnov` |
| Online ao vivo | 01/09/2026 | `.../p/checkout/3je9srypg3` |

## Rodar local
```bash
python3 -m http.server 8080
# ou
docker build -t lp-logica . && docker run -p 8080:80 lp-logica
```
