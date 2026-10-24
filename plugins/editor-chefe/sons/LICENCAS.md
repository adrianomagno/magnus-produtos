# Sons do Editor Chefe: origem e licença

Os arquivos de som desta pasta são de domínio público pela CC0 1.0 Universal
(https://creativecommons.org/publicdomain/zero/1.0/), baixados da origem em 2026-10-24.
Uso comercial permitido, sem atribuição obrigatória; os créditos ficam aqui por transparência.
Cada som foi preparado com o ffmpeg (corte do silêncio, cauda e pico, filtro abaixo) e medido
para o `manifest.json` (duração, instante e nível do pico, momentâneo máximo, volume).

## Origens

**Woven SFX** (sons CC0, código MIT)
- Repositório: https://github.com/woven-video/woven-sfx
- Commit fixado: `7dd52724affe89bf500c74854bfc1391d778a1ea` (2026-10-20)
- Licença dos sons: https://github.com/woven-video/woven-sfx/blob/7dd52724affe89bf500c74854bfc1391d778a1ea/SOUNDS_LICENSE (CC0 1.0)
- Arquivo de cada som: `https://raw.githubusercontent.com/woven-video/woven-sfx/7dd52724affe89bf500c74854bfc1391d778a1ea/sounds/<nome original>`
- Conferido: os arquivos de tom sintético da primeira versão do repositório foram trocados pela biblioteca gravada no
  commit `9d5aa40f` (2026-06-28). Os escolhidos têm espectro de gravação (vários parciais ou diferença entre os canais).
  Ficaram de fora `beep-short`, `airplane-ding` e `notification-ding`, que são um tom só.

**Kenney, UI Audio 1.0** (Kenney Vleugels, kenney.nl)
- Página: https://kenney.nl/assets/ui-audio
- Pacote: https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip
  (SHA-256 `946fc23a63d535d693eb31b2eabb80c8c28d6351e2186b344ceb71b2cb1d5eb6`)
- Licença: CC0, no `License.txt` do pacote ("License (Creative Commons Zero, CC0)
  http://creativecommons.org/publicdomain/zero/1.0/ ... Credit (Kenney or www.kenney.nl) would be nice but is not mandatory.")

**Kenney, Impact Sounds 1.0** (Kenney, kenney.nl)
- Página: https://kenney.nl/assets/impact-sounds
- Pacote: https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip
  (SHA-256 `029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8`)
- Licença: CC0, no `License.txt` do pacote ("License: (Creative Commons Zero, CC0)
  http://creativecommons.org/publicdomain/zero/1.0/ ... Support us by crediting Kenney or www.kenney.nl (this is not mandatory)")

## Arquivos

| Arquivo | Origem | Nome original | SHA-256 do original | Licença |
|---|---|---|---|---|
| `whoosh-rapido.mp3` | Woven SFX | `sounds/fast-whoosh.wav` | `87da86fc4da1eb53583c486cc2d40905ef38f413b64eed7852168c945f0c45b5` | CC0 1.0 |
| `whoosh-largo.mp3` | Woven SFX | `sounds/swish-whoosh-large.wav` | `dd03c5bb45d3e9f4ae57e876543ff52ceabe8ebd12597bbf600eedde41c8fd92` | CC0 1.0 |
| `whoosh-grave.mp3` | Woven SFX | `sounds/deep-whoosh.wav` | `4a5c795193bad8bf5528d58db8f40a15991f4c194d8abf1c33c6a431843a0d7e` | CC0 1.0 |
| `pop-mao.wav` | Woven SFX | `sounds/pop-hand.wav` | `02fed9196bc33a569ab3ddbdcc5d8b3c323346df6fb32e24b23930f990fc1cd5` | CC0 1.0 |
| `tique.wav` | Woven SFX | `sounds/tick-sound.wav` | `4f0cbac876d2514c36fba7f859eb9b41cfb360eba49f3bd27c2b9c2ffbd2bf71` | CC0 1.0 |
| `impacto-suave.mp3` | Kenney Impact Sounds | `Audio/impactSoft_heavy_000.ogg` | `49e7ca88743fca974bb8676ea138b751cfd8f9033b5e7af8736c2a215d6edbc1` | CC0 1.0 |
| `clique.wav` | Kenney UI Audio | `Audio/click3.ogg` | `e3e7fc7ccd9c5cfdf77bffa05aee10d4973812076c76dc889ba2b16ea434127f` | CC0 1.0 |
| `clique-suave.wav` | Kenney UI Audio | `Audio/click1.ogg` | `59175ac17cd49a68dd736285738441287636112a84a6f7ce0d89921bda5a5360` | CC0 1.0 |

Os 3 sons com origem `hyperframes` no `manifest.json` (`whoosh-short`, `pop`, `impact-bass-1`) não estão nesta pasta:
são do plugin hyperframes (`skills/media-use/audio/assets/sfx/`, licença Pixabay) e o Editor Chefe só copia os usados
para a pasta de cada vídeo, no computador do cliente (ver o `NOTICE` na raiz do repositório).

## Preparo (filtro do ffmpeg, a partir do original)

Silêncio do começo cortado 5 ms antes de passar de -50 dBFS, fim depois do último trecho acima de -60 dBFS, pico em
-1 dBFS, mono quando os dois canais do original são iguais. Mp3 a 128 kbps (mono a 96); o som de menos de 0,25 s vai em
WAV de 16 bits, porque mp3 de poucos quadros não é reconhecido sozinho pelo ffmpeg.

- `whoosh-rapido.mp3`: `atrim=start=0.0462:end=0.3518,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=0.2956:d=0.01,volume=7.14dB,pan=mono|c0=c0`
- `whoosh-largo.mp3`: `atrim=start=0.0003:end=0.7323,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=0.7221:d=0.01,volume=-1.00dB`
- `whoosh-grave.mp3`: `atrim=start=0.2495:end=1.6495,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=0.8000:d=0.6,volume=1.23dB` (cauda de 3,2 s cortada em 1,4 s)
- `pop-mao.wav`: `atrim=start=0.0102:end=0.1180,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=0.0978:d=0.01,volume=1.20dB,pan=mono|c0=c0`
- `tique.wav`: `atrim=start=0.0140:end=0.0600,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=0.0360:d=0.01,volume=9.41dB`
- `impacto-suave.mp3`: `atrim=start=0.0000:end=0.5193,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=0.5093:d=0.01,volume=-0.08dB,pan=mono|c0=c0`
- `clique.wav`: `atrim=start=0.0000:end=0.0932,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=0.0832:d=0.01,volume=-0.20dB`
- `clique-suave.wav`: `atrim=start=0.0000:end=0.1009,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=0.0909:d=0.01,volume=0.54dB`

Som novo nesta pasta: arquivo da origem com licença livre, uma linha na tabela acima e uma entrada no `manifest.json`
com a medida do `medirSom` (em `scripts/montar.mjs`); o teste `tests/sons.test.mjs` reprova o que faltar.
