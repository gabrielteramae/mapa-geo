# Norte — mapa de geolocalização

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-4264fb?style=flat&logo=maplibre&logoColor=white)

Mapa no navegador: lê onde você está, busca rua, praça ou cidade e guarda os pontos neste aparelho. Sem conta e sem chave de API.

| Escolha | Motivo |
| --- | --- |
| TypeScript | Coordenada, precisão do GPS e o que fica salvo têm tipo |
| React 19 | Painel, busca e pins atualizam juntos |
| Vite | A Geolocation API vive no navegador; um SPA sobe direto |
| MapLibre GL | Mapa vetorial, licença BSD. Os tiles vêm do OpenFreeMap |

## Stack

- React 19, TypeScript e Vite
- MapLibre GL JS com o estilo escuro (e o claro) do [OpenFreeMap](https://openfreemap.org/)
- Busca e nome do ponto via [Photon](https://photon.komoot.io/) (OpenStreetMap)
- Lugares no `localStorage` do aparelho, chave `norte.places.v1`
- Tailwind CSS 4 no painel

## Estrutura

```
index.html
vite.config.ts
public/favicon.svg
src/main.tsx
src/styles.css
src/components/norte/NorteApp.tsx
src/components/norte/MapCanvas.tsx
src/lib/norte/geo.ts
src/lib/norte/geocode.ts
src/lib/norte/places.ts
```

## Como rodar

```bash
git clone https://github.com/gabrielteramae/norte.git
cd norte
npm install
npm run dev
```

Abra http://localhost:5173.

O botão **Onde estou** pede a localização. Se o navegador bloquear, a busca e o toque no mapa continuam valendo. O mapa abre em São Paulo até o GPS responder.

| O quê | Onde |
| --- | --- |
| Posição | `navigator.geolocation`, só depois do toque |
| Busca | Photon, no máximo uma consulta a cada tecla pausada |
| Pontos salvos | `localStorage`, até 200 lugares |

`npm run build` gera a pasta `dist`.

## Testes

```bash
npm test
```

O script cobre distância, azimute, a leitura da resposta do Photon e o que pode entrar na lista salva. Não chama a rede. `npm run typecheck` só checa tipos.

---

© 2026 Gabriel Teramae Chan
