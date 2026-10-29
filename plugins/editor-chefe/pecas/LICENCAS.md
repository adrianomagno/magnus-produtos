# Peças do Editor Chefe: origem e licença

As peças animadas do estilo 11 (selo, cartão de lista, capítulo numerado, "Comenta PALAVRA", objeto 3D, ícone do
aplicativo em órbita, janela de navegador e esquema) são desenhadas no código do Editor Chefe (`estilos/pecas.js`), na
marca de cada cliente. Esta pasta guarda só os arquivos de terceiros que elas mostram: os objetos 3D, os ícones sóbrios e
os logos dos aplicativos. Cada arquivo foi baixado da origem em 2026-10-25, com a licença e o SHA-256 abaixo. Nada vem do Reel de
referência nem de pacote de outro editor.

## Objetos 3D: Fluent Emoji (Microsoft), licença MIT

- Repositório: https://github.com/microsoft/fluentui-emoji
- Commit fixado: `1ffb34c752ecf5d402f04cfb4b392c77f57c54bc` (2026-08-24)
- Arquivo de cada objeto: `https://raw.githubusercontent.com/microsoft/fluentui-emoji/1ffb34c752ecf5d402f04cfb4b392c77f57c54bc/<nome original>`
- Preparo: nenhum. Cada PNG é o original de 256x256 px, byte a byte (o SHA-256 da tabela é o do original e o do arquivo daqui).
- Licença (https://github.com/microsoft/fluentui-emoji/blob/1ffb34c752ecf5d402f04cfb4b392c77f57c54bc/LICENSE), copiada como manda a própria licença:

      MIT License

      Copyright (c) Microsoft Corporation.

      Permission is hereby granted, free of charge, to any person obtaining a copy
      of this software and associated documentation files (the "Software"), to deal
      in the Software without restriction, including without limitation the rights
      to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
      copies of the Software, and to permit persons to whom the Software is
      furnished to do so, subject to the following conditions:

      The above copyright notice and this permission notice shall be included in all
      copies or substantial portions of the Software.

      THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
      IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
      FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
      AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
      LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
      OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
      SOFTWARE

**3dicons (CC0):** conferido e não usado. A licença CC0 está declarada na página de cada ícone
(https://3dicons.co/icons/dd7474-calculator, campo `license: CC0`, "completely free and without attribution"), mas o
arquivo público (`.../sizes/<ícone>/dynamic/400/color.webp`) vem sem transparência, com fundo branco, e o estilo
metálico escuro destoa dos objetos do Fluent. Os 38 objetos do Fluent cobrem a lista do lote A.

| Arquivo | Origem | Nome original | SHA-256 | Licença |
|---|---|---|---|---|
| `objetos/acordo.png` | Fluent Emoji | `assets/Handshake/3D/handshake_3d.png` | `fd0c3ae54cf208f371636263f4c972b54ac929fef0455b9d15ce72c04fee0f2b` | MIT |
| `objetos/alerta.png` | Fluent Emoji | `assets/Warning/3D/warning_3d.png` | `318f534c5d93100443f6e48defc47d76140473d797087af5821587f0feb8003c` | MIT |
| `objetos/alvo.png` | Fluent Emoji | `assets/Bullseye/3D/bullseye_3d.png` | `2b2a2d9eec76c5649b8207b050f9135ce666c9d94694e5577aade50c53768437` | MIT |
| `objetos/ampulheta.png` | Fluent Emoji | `assets/Hourglass not done/3D/hourglass_not_done_3d.png` | `ab4183328a0ec7a0440a6fb48113fdb9145f51235e960c7f17097ebb9f13af97` | MIT |
| `objetos/balanca.png` | Fluent Emoji | `assets/Balance scale/3D/balance_scale_3d.png` | `442cfa3f13a9052484475e388e021f248fc39d20a8a7f36b30ea70adcad0d217` | MIT |
| `objetos/cadeado.png` | Fluent Emoji | `assets/Locked/3D/locked_3d.png` | `8c8e9209b8420ac7caf8c94fde6586044d9b91e85728aaaf4b98c2482761ea16` | MIT |
| `objetos/calendario.png` | Fluent Emoji | `assets/Spiral calendar/3D/spiral_calendar_3d.png` | `bdb3fc64cb0faa458cc6830407ad2d6a1e875082b3eb262104eb0034f86e2725` | MIT |
| `objetos/cama.png` | Fluent Emoji | `assets/Bed/3D/bed_3d.png` | `cf1bab4ad8cda94825bcc96874cad6b06459097455ea84c22a27d6d84ee510ea` | MIT |
| `objetos/cartao.png` | Fluent Emoji | `assets/Credit card/3D/credit_card_3d.png` | `8988e8c1f850752f517c28b46f7745c54621c79679cfa1b387e73741d2ba4935` | MIT |
| `objetos/casa.png` | Fluent Emoji | `assets/House/3D/house_3d.png` | `0279b073321551b55c86a10dc2fff5bf66c8dec895672004da43482c5a1de87c` | MIT |
| `objetos/celular.png` | Fluent Emoji | `assets/Mobile phone/3D/mobile_phone_3d.png` | `c72cf9f888cb74cb8852679184e0dac945ed0340839c98a86c653f51e1e3504d` | MIT |
| `objetos/chave.png` | Fluent Emoji | `assets/Key/3D/key_3d.png` | `ae59ce2b8dcfaa1afcdfe91bde7cc88cf06a8493686a6676706d1c891bb349eb` | MIT |
| `objetos/check.png` | Fluent Emoji | `assets/Check mark button/3D/check_mark_button_3d.png` | `256e3dd950cf1705ab72511ab242472b4bd7db519aa402a6182c1aaf8c58def9` | MIT |
| `objetos/contrato.png` | Fluent Emoji | `assets/Memo/3D/memo_3d.png` | `bddf602ea6a0988a77ef51187a3ac8b526791a614a8bb7123705359319a81dcd` | MIT |
| `objetos/coracao.png` | Fluent Emoji | `assets/Red heart/3D/red_heart_3d.png` | `7218cb9f08ed1ef38fcd83fe699a1125d07f50725f4c87a68cb7c9f4efb3c32b` | MIT |
| `objetos/dente.png` | Fluent Emoji | `assets/Tooth/3D/tooth_3d.png` | `a8465ebc90cfdb2c5854d00b5cfbfb324509dd3af9ccb88be1b445cc26bc7a69` | MIT |
| `objetos/dinheiro.png` | Fluent Emoji | `assets/Money bag/3D/money_bag_3d.png` | `cec19b9cf0beac5bbd27a07dcbe1e68c54b04112b4641165705ccb920f230292` | MIT |
| `objetos/documento.png` | Fluent Emoji | `assets/Page facing up/3D/page_facing_up_3d.png` | `f212d11ed09cfef2ca9cfd3b6b35b29ad7a57eb677aa6611fe284763303a1c57` | MIT |
| `objetos/envelope.png` | Fluent Emoji | `assets/Envelope/3D/envelope_3d.png` | `9671859aa64b65b6977b7ab6adc2e64220e75edf531a8e67c4b76e01ace04230` | MIT |
| `objetos/erro.png` | Fluent Emoji | `assets/Cross mark/3D/cross_mark_3d.png` | `2753b89dcd790c7f25fa3c5fd5641821860257364163abd87a2f57bb268466b9` | MIT |
| `objetos/estetoscopio.png` | Fluent Emoji | `assets/Stethoscope/3D/stethoscope_3d.png` | `5396b7ca1ffa1a040b260f2dc900fdfba087500ed2b51e8920ce45d745b5192e` | MIT |
| `objetos/foguete.png` | Fluent Emoji | `assets/Rocket/3D/rocket_3d.png` | `4636925a1dfc76a45dc83c08b983699d39143a0978f794a4e2dfb6cbffdcd7ab` | MIT |
| `objetos/grafico.png` | Fluent Emoji | `assets/Chart increasing/3D/chart_increasing_3d.png` | `dd5e6b29aa4067c5a4d9e152119497832d70e094b380998e5f5b0c51abbb3a64` | MIT |
| `objetos/hospital.png` | Fluent Emoji | `assets/Hospital/3D/hospital_3d.png` | `efdd62ac17fe3d726f82c67fe22b08d14138402648409ef4fe48d3e89f80d837` | MIT |
| `objetos/lampada.png` | Fluent Emoji | `assets/Light bulb/3D/light_bulb_3d.png` | `df7b09aa18301507e6fb8c279df66d9afa465b6fed3e63d2efa84dacebdbbf79` | MIT |
| `objetos/lupa.png` | Fluent Emoji | `assets/Magnifying glass tilted left/3D/magnifying_glass_tilted_left_3d.png` | `e8fea91e4652a36486aa9392a67873c987a13389afdae06bbcdae78ab30b4f4f` | MIT |
| `objetos/megafone.png` | Fluent Emoji | `assets/Megaphone/3D/megaphone_3d.png` | `78fd3bd1d93600888d4b06e157672c2dfb8058aaeb0f924fc461ca6af6e44c29` | MIT |
| `objetos/moeda.png` | Fluent Emoji | `assets/Coin/3D/coin_3d.png` | `17e2a0c226342fe2cdd2612c56f5dd188870d1435076f47600313c04876f843b` | MIT |
| `objetos/obra.png` | Fluent Emoji | `assets/Building construction/3D/building_construction_3d.png` | `eb5fefdc87925b3a86084672c3bfa9c25d4b41dab01d19a1c3877ec6f2213b2b` | MIT |
| `objetos/pasta.png` | Fluent Emoji | `assets/File folder/3D/file_folder_3d.png` | `d07ff91df2a4ad9f08e281e9b99ad66924b6db0c0afd2a938feca4dd6b7a9039` | MIT |
| `objetos/predio.png` | Fluent Emoji | `assets/Office building/3D/office_building_3d.png` | `a7bb5b154e6ea40eb22c2221333d51522c65ae0021320801383fe50ae32b0649` | MIT |
| `objetos/presente.png` | Fluent Emoji | `assets/Wrapped gift/3D/wrapped_gift_3d.png` | `fc9c446401c9fb347f4e9f47e6023247208126047d9ec32059d5e14e127fb562` | MIT |
| `objetos/queda.png` | Fluent Emoji | `assets/Chart decreasing/3D/chart_decreasing_3d.png` | `def4556976f4ea37549cdff95a9e677994acb2fe359a1b21dcd38ebc92b82925` | MIT |
| `objetos/recibo.png` | Fluent Emoji | `assets/Receipt/3D/receipt_3d.png` | `3a0d1b4ab48e5f181211f55d954de2e915db0a9749258c75cae8cff92f1983ba` | MIT |
| `objetos/relogio.png` | Fluent Emoji | `assets/Alarm clock/3D/alarm_clock_3d.png` | `1aa6929e1baa440db535fd321868dc76ddd888bf3e4f4333d37800ff2ec41c74` | MIT |
| `objetos/remedio.png` | Fluent Emoji | `assets/Pill/3D/pill_3d.png` | `39fea3b43ec3fcd7f42cd014f69fb145b2f87540ad823ac99f6c64b3288a76b4` | MIT |
| `objetos/seringa.png` | Fluent Emoji | `assets/Syringe/3D/syringe_3d.png` | `e0c3e61d61f380fc6e25dfdf715735a316d2efc1d4307e77cd3fd548d1824434` | MIT |
| `objetos/trofeu.png` | Fluent Emoji | `assets/Trophy/3D/trophy_3d.png` | `7c4a9805f354eb2aec35063a95a4043306efc726324c0d128883f24497857bbc` | MIT |

## Ícones sóbrios: Phosphor Icons, licença MIT

O segundo estilo dos objetos (`"icones": "sobrio"`), sem cara de emoji: o mesmo conceito de cada objeto 3D, em duas cores
da marca. É o estilo duotone do Phosphor: o Editor Chefe pinta o traço no escuro da marca e a forma de trás (a que vem com
20% de opacidade) na cor de destaque, sobre um disco branco.

- Repositório: https://github.com/phosphor-icons/core
- Commit fixado: `2b75f3ad12b420c9504ef05df8d2564a28f8500e` (2026-01-06), baixado em 2026-10-26
- Arquivo de cada ícone: `https://raw.githubusercontent.com/phosphor-icons/core/2b75f3ad12b420c9504ef05df8d2564a28f8500e/<nome original>`
- Preparo: nenhum. Cada SVG é o original, byte a byte, só com o nome do conceito; a cor entra na hora do vídeo, pelo CSS.
- Licença (https://github.com/phosphor-icons/core/blob/2b75f3ad12b420c9504ef05df8d2564a28f8500e/LICENSE), copiada como manda a própria licença:

      MIT License

      Copyright (c) 2023 Phosphor Icons

      Permission is hereby granted, free of charge, to any person obtaining a copy
      of this software and associated documentation files (the "Software"), to deal
      in the Software without restriction, including without limitation the rights
      to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
      copies of the Software, and to permit persons to whom the Software is
      furnished to do so, subject to the following conditions:

      The above copyright notice and this permission notice shall be included in all
      copies or substantial portions of the Software.

      THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
      IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
      FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
      AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
      LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
      OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
      SOFTWARE.

| Arquivo | Origem | Nome original | SHA-256 | Licença |
|---|---|---|---|---|
| `icones/acordo.svg` | Phosphor | `assets/duotone/handshake-duotone.svg` | `4f8827d067f5b777902e4e6e0f1e6ccc6b60c5d34605d65ecb8020137072ebb9` | MIT |
| `icones/alerta.svg` | Phosphor | `assets/duotone/warning-duotone.svg` | `5ae0c2cd3e764e0e82f03685657353b65499d6b231745af8516c140e8b1ba4af` | MIT |
| `icones/alvo.svg` | Phosphor | `assets/duotone/target-duotone.svg` | `f7e6e8cb3ff844db1ac5b65e34257651d7a55f68eb97da574ac369fcc259343f` | MIT |
| `icones/ampulheta.svg` | Phosphor | `assets/duotone/hourglass-medium-duotone.svg` | `a551caeac5d364285f82dd57f6d2dbc38a5f28482a36f0ca11af12beaa0bf1a9` | MIT |
| `icones/balanca.svg` | Phosphor | `assets/duotone/scales-duotone.svg` | `e31256959626a331a7949762141f67020126347e9421c66f04ed696b008002b6` | MIT |
| `icones/cadeado.svg` | Phosphor | `assets/duotone/lock-duotone.svg` | `08412a11cc0ebb4d842904f2930ebdf66d12439e95bfe6c5a7174505c0280149` | MIT |
| `icones/calendario.svg` | Phosphor | `assets/duotone/calendar-duotone.svg` | `e01b6303beb8d1d8a77b36087ab663bb3f6591fbc7256fda281406ed3bc9b5e1` | MIT |
| `icones/cama.svg` | Phosphor | `assets/duotone/bed-duotone.svg` | `eae20fa01ef5de4f014fbe56fbfbdcd47a627b0cc299d3f5b34393fcd363009a` | MIT |
| `icones/cartao.svg` | Phosphor | `assets/duotone/credit-card-duotone.svg` | `27169bdb3b0d960c41a01e44ee1c7bf9c3b102ba1403e7c72cbae63be8e704f7` | MIT |
| `icones/casa.svg` | Phosphor | `assets/duotone/house-duotone.svg` | `bd9f3502ab7d63c3cc8a3cf91657e5974188ede3bd1ac7249333d9ce5d0d932f` | MIT |
| `icones/celular.svg` | Phosphor | `assets/duotone/device-mobile-duotone.svg` | `dd1f130cc18a988d9e606f5253fb96f2c2b9502f1153b3685a4dd49628995b87` | MIT |
| `icones/chave.svg` | Phosphor | `assets/duotone/key-duotone.svg` | `c84fa84d090e51e1a43b2eebf3182c3cfb2c98cf64a2a7fab35b748ee2744c77` | MIT |
| `icones/check.svg` | Phosphor | `assets/duotone/check-circle-duotone.svg` | `d9c7016e83a81c8ef1a250a307acc6d29d5c492fc46066ab5e5e7446a65b48f6` | MIT |
| `icones/contrato.svg` | Phosphor | `assets/duotone/note-pencil-duotone.svg` | `42e4e6d15c523016812041aa4e692c8ab9b6d6488c7b8864adb537fefc083fee` | MIT |
| `icones/coracao.svg` | Phosphor | `assets/duotone/heart-duotone.svg` | `b1bc538e4f7626a2af3b3ac3dca543d8f8e628e9b45991fc7acb63ccaf2c289e` | MIT |
| `icones/dente.svg` | Phosphor | `assets/duotone/tooth-duotone.svg` | `9331f2069955b7efc8cb1ec4283eeaba52fa5ab99e4115fd467c0c68710a0ef8` | MIT |
| `icones/dinheiro.svg` | Phosphor | `assets/duotone/money-duotone.svg` | `4cf293632438f3e67c15e57181c9fb2ec2ad4f7d16d4e23e3fe8ef9f3af7dbc2` | MIT |
| `icones/documento.svg` | Phosphor | `assets/duotone/file-text-duotone.svg` | `6b0867a397af11f3c0a66091a4e17e3c172a42f48812ba99fc8157d9093cb7ea` | MIT |
| `icones/envelope.svg` | Phosphor | `assets/duotone/envelope-duotone.svg` | `8ae92e57426296fbd6a103ae896fd0ebcefc1c79bb31ff871eb88ef1e0fad308` | MIT |
| `icones/erro.svg` | Phosphor | `assets/duotone/x-circle-duotone.svg` | `62a1dc9fb293f84fd6671cc44ebeecbea30a52a671264d2a737b3e687d3d601f` | MIT |
| `icones/estetoscopio.svg` | Phosphor | `assets/duotone/stethoscope-duotone.svg` | `2b0c8777e6ea43ec2a831670f2dbd58063b77bca79baca9c4f42cd18985e1274` | MIT |
| `icones/foguete.svg` | Phosphor | `assets/duotone/rocket-duotone.svg` | `c3be115f1b9ec08db65b9ad3214407eb6cf2da1a5943b7425a5410b490c8059b` | MIT |
| `icones/grafico.svg` | Phosphor | `assets/duotone/chart-line-up-duotone.svg` | `86b5bfdff2eb2bc6fc8545a71950aef4185356ee9bde18191d543fee97ff4e30` | MIT |
| `icones/hospital.svg` | Phosphor | `assets/duotone/hospital-duotone.svg` | `52ae7d49f5d5b846a0c168e5bbf4c7ae2da2fe3232f828625a80deb5b236fdba` | MIT |
| `icones/lampada.svg` | Phosphor | `assets/duotone/lightbulb-duotone.svg` | `498e42a870d662fd36e7dba9b53fc82c3cdbe05452ad0534f3de8033dd07a2a6` | MIT |
| `icones/lupa.svg` | Phosphor | `assets/duotone/magnifying-glass-duotone.svg` | `7a840ea2341e75cf1d9187e07223be4501d6c6078a064a4097be07c1b3a52fb6` | MIT |
| `icones/megafone.svg` | Phosphor | `assets/duotone/megaphone-duotone.svg` | `04f73a1727252b5650265cb294d713988c5b353e83714c8674d64376170f678c` | MIT |
| `icones/moeda.svg` | Phosphor | `assets/duotone/coin-duotone.svg` | `cb9ae57d422bc770b183a9ef57de191e0f04d5cf0fff1f222ccac5a979cb10f6` | MIT |
| `icones/obra.svg` | Phosphor | `assets/duotone/crane-duotone.svg` | `ff65488554f6d202340ec07791f1bbbd08f57c6f7f194bf778b02f4b3eba7161` | MIT |
| `icones/pasta.svg` | Phosphor | `assets/duotone/folder-duotone.svg` | `13b80de6bee262ba8d1e1230d9926b1f3df1e25b91430a4d9c2c36e8a456c820` | MIT |
| `icones/predio.svg` | Phosphor | `assets/duotone/buildings-duotone.svg` | `d6843f7a68d132f539effacbfc5151d6a506ee983f1a409ad98a868d8be14713` | MIT |
| `icones/presente.svg` | Phosphor | `assets/duotone/gift-duotone.svg` | `8d1c765396fa149ee4d709be754945860dd1b034dab8572fa51a95c074f7a3bb` | MIT |
| `icones/queda.svg` | Phosphor | `assets/duotone/chart-line-down-duotone.svg` | `25367ce9cacc457857b13ca56c89e167c1a4022ec275a3a557c772d1bb3568d5` | MIT |
| `icones/recibo.svg` | Phosphor | `assets/duotone/receipt-duotone.svg` | `48bd25a0c53d8c5e49105a4208fd1297d30d89024eb04c5825983433fe256cc6` | MIT |
| `icones/relogio.svg` | Phosphor | `assets/duotone/alarm-duotone.svg` | `ed36a5bc7f4f5a27785ebe7ff5cd8f9b09d582305c4081a077e763fcf5d1afd6` | MIT |
| `icones/remedio.svg` | Phosphor | `assets/duotone/pill-duotone.svg` | `6221d6ff170ed8968322929de181b427b55f24eb0a6947a74d5b0e408d8f45ca` | MIT |
| `icones/seringa.svg` | Phosphor | `assets/duotone/syringe-duotone.svg` | `932ae1adfeee87a73dcec5d6908b158c2d23c9d277533a7b29d29bdfac38cfb2` | MIT |
| `icones/trofeu.svg` | Phosphor | `assets/duotone/trophy-duotone.svg` | `3e9f32441fc0315f359dbab71322d9e069cada283527918360d6789a84c7bf14` | MIT |

## Logos de aplicativo

Registro técnico de cada arquivo: a fonte, a data do download, o SHA-256 do original e o que foi feito nele. O SHA-256 do arquivo
desta pasta está no `manifest.json`. Fontes, nesta ordem: a página de marca ou de imprensa da empresa, o site oficial dela, o
Wikimedia Commons e o Simple Icons. Todo SVG daqui passa pela regra do SVG seguro (`problemasSvg`, em `scripts/banco.mjs`): só
elementos e atributos de desenho, sem `style`, CSS, `use`, `url(`, script, evento, link nem imagem; o logo que não passa entra
convertido para PNG (o teste `tests/pecas.test.mjs` reprova SVG fora da regra).

| Arquivo | Fonte | Baixado em | Original e SHA-256 | Preparo |
|---|---|---|---|---|
| `apps/whatsapp.png` | https://www.meta.com/brand/resources/whatsapp/whatsapp-brand/ | 2026-10-25 | pacote `WhatsApp-Brand-Resource-Center.zip` (`31cd2eaacb0abfd3640e51cb807c21dafba872e3aff8e520ff20ee6a1b01498f`), arquivo `01_Glyph/01_Digital RGB/03_SVG/Digital_Glyph_Green_RGB_2026.svg` (`f7b1311db718533e671645f57cd94b92f0e006e61d7e6581a80675fc5a478fc4`) | convertido do SVG original para PNG de 256 px, com transparência (sharp 0.35.5, librsvg 2.63.2), porque o SVG usa `<style>` e `class`, fora da regra do SVG seguro |
| `apps/instagram.png` | https://www.meta.com/brand/resources/instagram/instagram-brand/ | 2026-10-25 | pacote `IG_brand_asset_pack_2023.zip` (`a9e5cbe63dc01279b3d12d536ea9d94ab5236521601bd5cc4b4caf7ba7060e82`), arquivo `01 Static Glyph/01 Gradient Glyph/Instagram_Glyph_Gradient.png` (`21f86b55f986848665ce54ab354ff6b43b7705e6c421d90c04369882b5956766`) | reduzido de 5000 para 256 px (`sips -Z 256`) |
| `apps/facebook.png` | https://www.meta.com/brand/resources/facebook/logo/ | 2026-10-25 | pacote `Facebook-Brand-Asset-Pack.zip` (`5c51e2c9c2377b1656a3294b391ed4a42f88dd8c46fc05b98d3bc27affc97f3a`), arquivo `Logo/Primary Logo/Facebook_Logo_Primary.png` (`2adfd474d91fd20c51084309ed000c1ae6cc7f5f70af14d375930f5a71301308`) | reduzido de 2084 para 256 px |
| `apps/youtube.png` | https://brand.youtube/youtube-icon/ (pacote https://www.gstatic.com/marketing-cms/78/29/3e68a1414bb28d0b7e47b44c3c91/youtube-icon.zip) | 2026-10-25 | pacote `youtube-icon.zip` (`ca9b5104387e0f7afcfda3a79c910449561112f1077177dd0d64f8c72f56e476`), arquivo `YouTube_Icon/Digital/01 Red/yt_icon_red_digital.png` (`1027b1b0517727adb9697155a270744381c3ce9b047b1c8bd8a9389dc7d07a83`) | reduzido de 1255 para 256 px de largura |
| `apps/linkedin.png` | https://brand.linkedin.com/downloads (pacote https://content.linkedin.com/content/dam/me/business/en-us/amp/xbu/linkedin-revised-brand-guidelines/logos/in-logo.zip) | 2026-10-25 | pacote `in-logo.zip` (`32c4b7bbf902c1d957881e2eca16bc765891dc86da8ce4d416a849f161222a87`), arquivo `in-logo/LI-In-Bug.png` (`3c0149f26168b5fe0f43e68664abe40341a6443b3cd435d18a73e12f64f8b600`) | reduzido de 635 para 256 px de largura |
| `apps/threads.svg` | https://www.meta.com/brand/resources/threads/ | 2026-10-26 | pacote `Threads-Brand-Resource-Center.zip` (`4528eaccd3f0500fad585bce736f1d84444352f445c0dfbd2ba01e29ec58bf27`), arquivo `Threads-Brand-Resource-Center/02 Black/Logo/threads-logo-black.svg` (`82b6bfe6c7f21bec096ad95c08fa2348f9105a8f9f910691b46eb0599f8f5f40`) | nenhum |
| `apps/telegram.png` | https://telegram.org/press (pacote https://telegram.org/file/464001088/1/bI7AJLo7oX4.287931.zip/374fe3b0a59dc60005) | 2026-10-26 | pacote (`8b1924b30790b3557cd1a76c4028403035dae386f282aaa3d741c5bc5a03d8a7`), arquivo `Logo.svg` (`54842d414c100f0110f90caf09ff58cd0d229629820e4576bd70befca88befd5`) | convertido do SVG original para PNG de 256 px, com transparência (sharp 0.35.5, librsvg 2.63.2), porque o SVG usa gradiente, máscara ou filtro por `url(#...)`, fora da regra do SVG seguro |
| `apps/perplexity.svg` | https://live.standards.site/perplexity/logo (pacote https://firebasestorage.googleapis.com/v0/b/standards-site-beta.appspot.com/o/documents%2F6t12iheczyb%2F732776432bb%2FPerplexity%20Logo%20Nov%202025.zip?alt=media&token=408ae771-e0cc-40f7-bb5c-00e6a82ab7fb) | 2026-10-26 | pacote `Perplexity Logo Nov 2025.zip` (`4e2773dba4fe10a508ae33f0d517362a1ebac6c671ef790e3bf61ecc96b0e006`), arquivo `Perplexity Logo Nov 2025/Symbol/Perplexity-Symbol-Color-Light.svg` (`9efdb9a753eb84b2239b1f8df7dea9fdd30b5898a3f60a5e3b84da20898ef954`) | prancheta recortada: o original é uma prancheta de 1920x1080 com um retângulo de fundo `#fcfcf9`; ficou o mesmo `path`, na cor `#20808d`, com o `viewBox` `829.4 372 276.4 335.9` e sem o retângulo |
| `apps/trello.svg` | https://atlassian.design/foundations/logos (pacote https://atlassian.design/assets/ea513a1d5d9c/logos/trello_app.zip) | 2026-10-26 | pacote `trello_app.zip` (`f4904ebf62ab7a968bb6e6cc88fb512b1604586748bfcc3b7960c7b561868296`), arquivo `trello/svg/Trello_icon.svg` (`8e0693f3d8c757c43cf702bb34e7d57012792355f1a8799207d006cf7d84f211`) | nenhum |
| `apps/claude.svg` | https://www.anthropic.com/press-kit (pacote https://www-cdn.anthropic.com/ae59ca4ca194dac9c9dc3bc78c5829468cb0e8af.zip) | 2026-10-26 | pacote (`c68ac92df86c825f95177e24016fcc9a8863a3fd4ca344fe6f0700b2c1e07151`), arquivo `Anthropic media resources/Anthropic logos/Claude logos/3 Claude Spark/SVG/Claude Spark - Clay.svg` (`6d53db4be375e899c937c26cf16684a80d6e869b1928d72b37748bef2560e219`) | nenhum |
| `apps/chatgpt.svg` | Wikimedia Commons, https://commons.wikimedia.org/wiki/File:ChatGPT-Logo.svg (arquivo https://upload.wikimedia.org/wikipedia/commons/e/ef/ChatGPT-Logo.svg; autor registrado: OpenAI; licença registrada: domínio público) | 2026-10-26 | o arquivo (`a66ba245fc68677ae1a47a5f726d60d691e4c8d5942028328dc2beb3b8ceb4dc`) | nenhum |
| `apps/gemini.png` | site oficial do Google Workspace, https://workspace.google.com/intl/pt-BR/products/drive/ (arquivo https://www.gstatic.com/images/branding/productlogos/gemini_2025/v1/web-96dp/logo_gemini_2025_color_2x_web_96dp.png) | 2026-10-26 | o arquivo, 192x192 px | nenhum |
| `apps/google-drive.png` | site oficial do Google Workspace, https://workspace.google.com/intl/pt-BR/products/drive/ (arquivo https://www.gstatic.com/images/branding/productlogos/drive_2026/v2/web/192px.svg) | 2026-10-26 | o arquivo (`60a6496d705d8bf010ce126469be89889db331622b14d8ae1645a38c2aaa23f5`) | convertido do SVG original para PNG de 256 px, com transparência (sharp 0.35.5, librsvg 2.63.2), porque o SVG usa gradiente, máscara ou filtro por `url(#...)` e `style`, fora da regra do SVG seguro |
| `apps/gmail.png` | site oficial do Google Workspace, https://workspace.google.com/intl/pt-BR/products/drive/ (arquivo https://www.gstatic.com/images/branding/productlogos/gmail_2026/v2/web/192px.svg) | 2026-10-26 | o arquivo (`0a242131424b796a26247a8edd41d66fa294da6d177897526a19b7e81aedfdb8`) | convertido do SVG original para PNG de 256 px, com transparência (sharp 0.35.5, librsvg 2.63.2), porque o SVG usa gradiente, máscara ou filtro por `url(#...)`, fora da regra do SVG seguro |
| `apps/google-agenda.png` | site oficial do Google Workspace, https://workspace.google.com/intl/pt-BR/products/drive/ (arquivo https://www.gstatic.com/images/branding/productlogos/calendar_2026/v2/web/192px.svg) | 2026-10-26 | o arquivo (`7f55cd877b2261948168db3d2e9468c0cf3f07766789489e853a0f9931dff8ea`) | convertido do SVG original para PNG de 256 px, com transparência (sharp 0.35.5, librsvg 2.63.2), porque o SVG usa gradiente, máscara ou filtro por `url(#...)` e `style`, fora da regra do SVG seguro |
| `apps/google-meet.png` | site oficial do Google Workspace, https://workspace.google.com/intl/pt-BR/products/drive/ (arquivo https://www.gstatic.com/images/branding/productlogos/meet_2026/v2/web/192px.svg) | 2026-10-26 | o arquivo (`ae2e86aa009fd7e1952082bff7d4fa9eca8f45ff46d0298800d53c5d6bdcb3b4`) | convertido do SVG original para PNG de 256 px, com transparência (sharp 0.35.5, librsvg 2.63.2), porque o SVG usa gradiente, máscara ou filtro por `url(#...)` e `style`, fora da regra do SVG seguro |
| `apps/google-planilhas.png` | site oficial do Google Workspace, https://workspace.google.com/intl/pt-BR/products/drive/ (arquivo https://www.gstatic.com/images/branding/productlogos/sheets_2026q3/v1/web/192px.svg) | 2026-10-26 | o arquivo (`3dd989706d03cf9ed780beb45af592bb46aa777edcc18543ea0764463ec936d2`) | convertido do SVG original para PNG de 256 px, com transparência (sharp 0.35.5, librsvg 2.63.2), porque o SVG usa gradiente, máscara ou filtro por `url(#...)` e `style`, fora da regra do SVG seguro |
| `apps/google-docs.png` | site oficial do Google Workspace, https://workspace.google.com/intl/pt-BR/products/drive/ (arquivo https://www.gstatic.com/images/branding/productlogos/docs_2026/v2/web/192px.svg) | 2026-10-26 | o arquivo (`ce8a250ed67fa813f00e2f2be6fcf515b284dbd0c7fa29aab254b1ba8310258c`) | convertido do SVG original para PNG de 256 px, com transparência (sharp 0.35.5, librsvg 2.63.2), porque o SVG usa gradiente, máscara ou filtro por `url(#...)` e `style`, fora da regra do SVG seguro |
| `apps/tiktok.png` | página de desenvolvedor do TikTok, https://developers.tiktok.com/doc/getting-started-design-guidelines (pacote https://sf16-va.tiktokcdn.com/obj/eden-va2/uvzhqeh7nuhd/tt4d/logo-pack.zip) | 2026-10-26 | pacote `logo-pack.zip` (`b3f31728ceb6ce6fc1a0ae8c635a0223e35ac2f7d203b2743e713541bf2085cd`), arquivo `Dev Portal Logo Pack/TikTok Logo Pack/TikTok - Icons/TikTok_Icon_Black_Square.png` (`e8013e14350422f54f4b61735d91e232bf02972f6156d979cd82905559f5ee2e`) | reduzido de 1200 para 256 px (`sips -Z 256`) |
| `apps/x.png` | site oficial do X, https://x.com/ (arquivo https://x.com/apple-touch-icon.png, o ícone do app declarado no `<link rel="apple-touch-icon">`) | 2026-10-26 | o arquivo, 1024x1024 px (`a83542eb0563242949d7dbde720014fb7ab48ae14ed59f43eec34907cb90c477`) | reduzido de 1024 para 256 px (`sips -Z 256`) |
| `apps/pinterest.png` | site oficial do Pinterest, https://www.pinterest.com/ (arquivo https://s.pinimg.com/webapp/logo_transparent_144x144-3da7a67b.png) | 2026-10-26 | o arquivo, 144x144 px | nenhum |
| `apps/notion.png` | site oficial do Notion, https://www.notion.com/ (arquivo https://www.notion.com/front-static/logo-ios.png, o ícone do app declarado no `<link rel="apple-touch-icon">`) | 2026-10-26 | o arquivo, 512x512 px (`483846a85e43e22879445047b83b22033e70fcc25ab34809ebadb7f856507ee0`) | reduzido de 512 para 256 px (`sips -Z 256`) |
| `apps/canva.png` | Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Canva_Logo.jpg (arquivo https://upload.wikimedia.org/wikipedia/commons/d/d8/Canva_Logo.jpg; licença registrada: CC0) | 2026-10-26 | o arquivo, JPG de 320x108 px (`6ad877f0fce21ec793ea53e718a689f641d61b6d123693b0b56c671c93815d98`) | convertido de JPG para PNG e reduzido de 320 para 256 px de largura (`sips -s format png -Z 256`) |
| `apps/zoom.svg` | Zoom Brand Center, https://brand.zoom.com/document/8 (asset `Zoom_Logo_Bloom_RGB`, SVG; arquivo https://media.ffycdn.net/us/zoom-video-communications/TM2yntcD58CmV921jBBa.svg) | 2026-10-26 | o arquivo | nenhum |

Simple Icons: conferido para o Canva e não usado; o ícone saiu do repositório em 2025-11-29 (commit `bdd96679bb`, "Remove Canva").
Os desenhos neutros de `EC.NEUTROS` (`estilos/comum.js`) ficam como reserva interna do Editor Chefe; nenhum aplicativo do banco usa.

## Banco central de peças

As peças do banco central (a pasta `biblioteca/` do repositório, lida pelo commit de `banco-central.json`) trazem no
catálogo dela a origem, a licença, a fonte e o SHA-256 de cada arquivo. As do Fluent Emoji e do Phosphor seguem as licenças
MIT copiadas acima. Na biblioteca local do cliente, o `catalogo.json` guarda o mesmo registro de cada peça usada.

## Peça nova nesta pasta

Arquivo da origem com licença livre (ou do kit de marca oficial, no caso de logo), uma linha numa das tabelas acima e
uma entrada no `manifest.json` com o arquivo, a origem e o SHA-256; o teste `tests/pecas.test.mjs` reprova o que faltar.
