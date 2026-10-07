# Antenados na IA — Landing Page

Landing page mobile-first do produto **Antenados na IA** (Clube dos Antenados).

## Como ver

Abra `index.html` no navegador, ou sirva a pasta com qualquer servidor estático.

```bash
npx --yes serve .
```

## Configurar assets

Edite [`js/config.js`](js/config.js):

| Campo | O que colocar |
|---|---|
| `checkoutUrl` | Link de checkout Hotmart |
| `whatsappUrl` | Já aponta para `(35) 99716-0702` |
| `vsl.embedUrl` | URL de embed YouTube/Vimeo (com permissão de autoplay) |
| `vsl.posterSrc` | Imagem de capa do VSL (opcional) |
| `instructorPhoto` | Foto do Matheus (ex.: `assets/matheus.jpg`) |
| `testimonials[].photoSrc` / `videoSrc` | Foto ou vídeo de depoimento |

Páginas legais: [`privacidade.html`](privacidade.html) e [`termos.html`](termos.html).
