# Novidades do Editor Chefe

A versão mais nova fica no alto. Datas no formato ano-mês-dia.

## 0.10.0 (teste, 2026-11-12)

- **Reel sem gravação (estilo 10) com a voz do UltraVoice.** O Motion narrado agora aceita a voz do UltraVoice, o nosso caminho de voz sem custo: a voz que o dono aprovou no app VoiceStudio, gerada no computador dele, sem o texto sair de lá. Com o perfil da voz no `marca.json` (`voz.ultravoice_perfil`), ela é a padrão; sem ele, a voz sai da ElevenLabs, como antes; sem nenhuma das duas, o Editor Chefe pede uma. Se o perfil está lá e o app está fechado, ele para e pede para abrir, sem trocar sozinho para a ElevenLabs paga (com o sim do dono, `--elevenlabs` gera por ela).
- **O tempo de cada palavra, também no UltraVoice.** O UltraVoice não diz quando cada palavra é falada. O Editor Chefe transcreve a voz gerada com a mesma transcrição que legenda os vídeos gravados e alinha com o texto aprovado, palavra por palavra; palavra ouvida diferente fica com o tempo do lugar e aparece numa lista para ouvir na prévia. O `words.json` sai no mesmo formato da ElevenLabs, e o resto do estilo não muda. Se a transcrição reconhece menos de 70% do texto, ele para e pede para gerar de novo.
- **O mesmo dicionário de pronúncia nos dois caminhos.** Antes de gerar, o texto passa pelo dicionário do UltraVoice (`scripts/pronuncia.txt`): "OAB" vira "Óabê" e "A.I." vira "Ei Ai". A voz fala a troca; a legenda continua com a palavra do roteiro.
- **A conferência de dado pessoal continua valendo** nos dois caminhos: CPF, CNPJ, telefone, e-mail ou nome de pessoa no roteiro param a geração até o dono tirar ou confirmar.
- **Ainda não testado com a voz de verdade:** os testes usam uma cópia falsa do app e da transcrição. A geração com o VoiceStudio real, num Mac com chip Apple, e o resultado ouvido ficam para a conferência antes de publicar.

## Versões anteriores

- **0.9.3** (2026-11-08): título no ritmo da fala, marca-texto na palavra forte e estilo 8 com a fala inteira nos cartões, sem legenda.
- **0.9.2** (2026-11-06): rosto no terço de cima, tela dividida 40/60 e capa do perfil com o ângulo bonito.
- **0.9.1** (2026-10-30): banco central de peças ligado, lido pelo commit fixo e conferido pelo SHA-256.
- **0.9.0** (2026-10-29): estilos Destaques tipográficos e Papelaria, peças em duas famílias, 24 logos de aplicativo e banco de peças que se alimenta sozinho.
- **0.8.2** (2026-10-27): o vídeo termina sem quadro vazio e o áudio não trava com a máquina carregada.
- **0.8.1** (2026-10-24): nenhum quadro sem vídeo nas emendas.
- **0.8.0** (2026-10-24): corte fino com a melhor tomada, efeitos sonoros CC0, aviso de dado pessoal na tela e mesmo estilo do último vídeo.
- **0.7.0** (2026-10-22): capa do perfil com gancho para a grade do Instagram.
- **0.6.1** (2026-10-19): aproximação no rosto nas frases de ênfase e visuais de cor fortes.
- **0.6.0** (2026-10-19): enquadramento que segue o rosto, limpeza de ruído, visuais de cor e conferência automática.
- **0.5.2** (2026-10-16): sem regras de proibição de voz, música ou imagem.
- **0.5.1** (2026-10-16): preparar com autoteste, roteiro como referência e README em 6 passos.
- **0.5.0** (2026-10-16): catálogo único dos estilos e das capas e confirmação do pedido preenchido.
- **0.4.0** (2026-10-15): estilo 10, Motion narrado.
- **0.3.2** (2026-10-12): caminho da pasta de dados no Windows.
- **0.3.1** (2026-10-12): legenda opaca no Painel escuro.
- **0.3.0** (2026-10-12): estilos de tela dividida e roteiro com trecho e tipo de vídeo.
- **0.2.1** (2026-10-12): capa sem cópia repetida quando o primeiro trecho é curto.
- **0.2.0** (2026-10-11): gancho de capa (Faixa, Manchete, Editorial) e o estilo Caixinha de pergunta.
- **0.1.0** (2026-10-10).
