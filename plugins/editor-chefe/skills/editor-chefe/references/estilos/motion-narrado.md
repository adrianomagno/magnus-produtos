# Motion narrado

**Quando usar:** o dono não tem gravação. Ele tem um texto, de preferência uma frase que ele já disse numa aula, live ou áudio, e quer um Reel só de animação, narrado com voz, com cada palavra-chave entrando na tela no instante em que é dita. De 20 a 30 segundos.

**Fluxo da HyperFrames:** composição da `hyperframes-core` sem vídeo, com o tempo de cada palavra tirado do alinhamento do próprio texto (não há transcrição), no molde `estilos/motion-narrado.html` do plugin, que o `scripts/montar.mjs` preenche com a marca, as palavras e as escolhas. A voz sai do `scripts/voz-com-tempos.mjs` (ElevenLabs, endpoint `with-timestamps`, modelo `eleven_v3`). A animação é determinística: cada quadro sai igual, em qualquer ordem em que o render pedir.

**O que sai do computador:** o texto do roteiro vai para a ElevenLabs, pela conta do próprio dono, para virar voz. Nada vai para o servidor MAGNUS. Diga isso ao dono antes de gerar a voz.

## Antes de começar, confira

- **O texto aprovado pelo dono**, com 55 a 70 palavras (cerca de 20 a 30 s). Frase que ele já disse rende mais que frase de efeito escrita do zero. A voz fala exatamente o que estiver escrito: mostre o texto final e espere o ok dele antes de gerar a voz, porque cada geração gasta créditos da conta dele.
- **A voz:** `voz.elevenlabs_voice_id` no `marca.json` (`marca.md`, seção "Voz"). É a voz da conta dele na ElevenLabs que ele escolher.
- **A chave** da ElevenLabs guardada no computador do dono, pelo comando de `marca.md`, nunca no pacote e nunca escrita na conversa.

## Desenho

- **Layout:** 1080x1920, fundo em `cores.fundo_escuro` com uma grade sutil (linhas a 5% da cor clara, sumindo para as bordas). No meio da tela, de 860 a 1060 px, a palavra-chave grande; logo abaixo, a barra na cor de destaque; embaixo, a 1150 px, a legenda da narração. Em cima, a 640 px, o ícone da palavra-chave, se ela tiver.
- **Capa no quadro 0:** a primeira palavra-chave já está na tela no primeiro quadro, com a barra embaixo, e pulsa quando é dita (cresce 12% e assenta). Com ícone, ele também já está desenhado e pulsa junto.
- **No máximo 6 palavras na tela:** a palavra-chave (até 3 palavras) e uma linha de legenda com o que sobra de 6. A legenda leva só as palavras de fora das chaves, em frases (quebra em pontuação e em pausa) e, quando a frase é longa, em linhas equilibradas; cada palavra se escreve letra a letra no instante em que é dita.
- **Objetos que se transformam:** a barra sublinha cada palavra-chave, vira um traço curto no meio da tela na troca (onde a próxima vai bater), cresce até a largura da seguinte e, no fim, vira a linha do fecho. O ícone se desenha traço a traço e se apaga na troca; o mesmo ícone na palavra seguinte fica e pulsa.
- **Entradas:** cada palavra da chave bate no instante em que é dita (entra em 114% e assenta, sem quicar). A anterior sai 0,25 s antes da seguinte bater, para nunca haver duas no mesmo lugar.
- **Tipografia:** palavra-chave em `fontes.titulo`, peso 800, caixa alta, 200 px (encolhe até caber em 940 px); legenda e assinatura em `fontes.corpo`, peso 400.
- **Cores:** palavra-chave e nome na cor clara (clareada até 7:1 contra o fundo, se a marca pedir); legenda um pouco mais apagada, mas legível (4,6:1); a palavra do ápice na cor de destaque, clareada até 4,6:1; barra e ícones na cor de destaque com pelo menos 3:1. Uma cor de destaque só, sem neon, partícula ou degradê.
- **Fecho:** o `logo` do `marca.json`, se houver, ou o `nome`, com a barra embaixo e a `assinatura` (se for diferente do nome). Sem `"fecho"` no `escolhas.json`, entra logo depois da última palavra e fica 1,5 s; com `"fecho"`, entra na palavra em que começa a assinatura falada.

## Efeitos sonoros

- **Impacto grave** no pulso da capa e na palavra do ápice (principal).
- **Curto** (estalo, pop e ping, alternados) em cada uma das outras palavras-chave, com uma camada de impacto grave por baixo.
- **Carrilhão** no fecho (longo).
- A legenda e o ícone ficam sem som. Dois efeitos a menos de 0,5 s um do outro: fica o mais forte.

Volume medido, não chutado: o principal a 2 dB abaixo do momentâneo máximo da voz; o curto a 6 dB abaixo da voz naquele instante; o longo a 8 dB abaixo. O pico de cada efeito é normalizado antes da mistura e, se nem com volume cheio ele chega ao alvo, um limitador o empurra sem passar o pico. O montador soma voz e efeitos e grava `audio/mix.wav` já em -16 LUFS, com o pico abaixo de -1 dBTP; o relatório de cada efeito fica em `audio/mixagem.json`. Os sons são do plugin hyperframes (`skills/media-use/audio/assets/sfx/`, licença Pixabay, uso comercial sem atribuição). Ligados por padrão; `"efeitos": false` no `escolhas.json` deixa só a voz.

## Como montar

Na pasta do vídeo, `Documentos/Editor Chefe/<AAAA-MM-DD>-<nome curto>/`, sempre com o prefixo `eval` da SKILL:

1. **O texto:** salve o texto aprovado em `roteiro.txt`. Escreva número, sigla e símbolo por extenso ("quinhentos reais", não "R$ 500"): a voz fala por extenso e as palavras precisam bater com o roteiro.
2. **A voz e o tempo de cada palavra:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/voz-com-tempos.mjs" .` grava `audio/voz.wav` e `words.json` (e guarda `audio/voz-crua.mp3` e `audio/alinhamento-caracteres.json`). Ele acelera a voz até 1,10x quando ela vem lenta (alvo de 2,54 palavras por segundo, que `voz.ritmo` muda) e para se as palavras da voz não baterem com o roteiro, dizendo qual; aí corrija o `roteiro.txt` e rode de novo. Cada rodada gasta créditos: não rode de novo sem mudar o texto. Antes de mandar o texto para a ElevenLabs, ele procura no roteiro o que parece dado pessoal (CPF, CNPJ, telefone, e-mail, nome de pessoa; o nome do negócio e os aplicativos não contam) e para se achar, dizendo o quê. Aí diga ao dono, numa frase, o que achou e espere a resposta: se ele tirar, salve o `roteiro.txt` novo e rode de novo; se ele confirmar que pode ir assim, rode com `--confirmado` no fim.
3. **As fontes:** baixe as de `fontes.titulo` e `fontes.corpo`, como manda `marca.md`.
4. **As palavras-chave**, de 5 a 7, na ordem em que são ditas, uma a cada 2 a 4 segundos; a primeira é a capa e deve ser dita nos primeiros segundos. Cada uma tem até 3 palavras seguidas e 24 caracteres, escritas como no `words.json` (acento e pontuação não contam). Leia o `words.json` para escolher. Escreva o `escolhas.json` na pasta do vídeo:

       {
         "estilo": "motion-narrado",
         "chaves": ["desconfiança", { "texto": "confirmar", "icone": "calendario" }, "lista de espera", "vazio", "mensagem", "vaga"],
         "apice": "vazio",
         "fecho": "Estúdio",
         "quebras": ["fica de fora"]
       }

   - `"chaves"`: cada uma como texto ou como `{ "texto": "...", "icone": "..." }`. O ícone é opcional e sai da mesma biblioteca do Motion dividido (a tabela "Os ícones" de `motion-dividido.md`); se nenhum combina com o que foi dito, deixe sem.
   - `"apice"` (opcional): a palavra-chave mais forte, na cor de destaque e com o impacto grave.
   - `"fecho"` (opcional): quando o texto termina com a assinatura falada ("Estúdio Exemplo. Atendimento com hora marcada."), a primeira palavra dela. Dali em diante a legenda para e a tela mostra o nome (ou o logo) e a assinatura do `marca.json`; a assinatura entra na frase seguinte da fala.
   - `"quebras"` (opcional): trechos da fala, na ordem, que começam uma linha nova da legenda, para respeitar um corte natural da frase.
   - O montador lê a marca em `../marca.json` (troque com `"marca": "<caminho>"`). `"efeitos"` é opcional: `true` (padrão) ou `false`. Este estilo não leva `"capa"`: a primeira palavra-chave já é a capa.
5. **Monte:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/montar.mjs" .` grava `index.html`, `comum.js`, `audio/mix.wav`, `audio/mixagem.json` e os efeitos preparados em `efeitos/`. Ele para com erro em português se uma palavra-chave não está na fala (ou está fora de ordem), se passa de 3 palavras, se são menos de 3 ou mais de 9, se o ícone não é da biblioteca ou se falta a voz. E avisa, sem parar, quando a mesma palavra-chave fica mais de 4,5 s na tela (escolha mais uma nesse trecho), quando duas estão a menos de 1 s (troque uma), quando o fecho fica parado mais de 4,5 s e quando o vídeo sai fora de 20 a 30 s. Corrija o `escolhas.json` e monte de novo.

## Prévia, conferência e render

1. Prévia dos primeiros 10 segundos (a raiz deste molde tem `data-fps="60"` depois da duração, por isso o `sed` é outro):

       sed 's/data-duration="[0-9.]*" data-fps/data-duration="10" data-fps/' index.html > previa.html
       hf render . -c previa.html -o previa.mp4
       rm previa.html

   Ajuste pelo que o dono disser no `escolhas.json` e monte de novo; não edite o `index.html` à mão. Texto novo é voz nova: volte ao passo 2 (gasta créditos).
2. Antes do render final: `hf lint .` e `hf check . --strict`, os dois sem erro e sem aviso.
3. Render final: `hf render . -o "../prontos/<AAAA-MM-DD>-<nome curto>.mp4"`.
4. **Antes de entregar**, além do que pede `entrega.md`:
   - a duração (`ffprobe`) entre 20 e 30 s e maior que o `end` da última palavra do `words.json`;
   - o áudio do MP4 em -16 LUFS (perto) e o pico verdadeiro abaixo de -1 dBTP: `ffmpeg -nostats -i <mp4> -af ebur128=peak=true -f null -` e leia o resumo (`I` e `Peak`);
   - cada palavra-chave entrando quando é dita: `hf snapshot . --at <start da palavra + 0,05> --describe false` mostra a palavra já na tela.

## Cuidados

- **Palavras do dono, nunca inventadas:** o texto é o que ele aprovou, e as palavras-chave e a legenda saem dele. Não acrescente promessa, número ou resultado.
- **A voz fala o que está escrito:** sigla vira letra por letra, número com algarismo pode virar outra grafia e parar o `voz-com-tempos.mjs`. Escreva como se fala.
- **Créditos da ElevenLabs:** cada rodada do `voz-com-tempos.mjs` gasta créditos da conta do dono, cerca de um por caractere. Gere a voz só com o texto aprovado.
- **O render não precisa de internet:** o GSAP vem no plugin (`estilos/gsap.min.js`, conferido pelo SHA-256), e o montador copia o arquivo para a pasta do vídeo.
- **Sem o plugin hyperframes:** o montador para dizendo que não achou os efeitos sonoros. Instale o plugin hyperframes do mesmo marketplace e abra uma conversa nova; se não der, monte com `"efeitos": false`.
- **Logo escuro:** o fecho fica sobre o fundo escuro. Use a versão clara do logo, com fundo transparente (PNG ou SVG); se não houver, deixe sem logo e o fecho mostra o nome.
