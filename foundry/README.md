# Trespasser · Custom System Builder

Pacote fan-made por [Th3Unforg1ven](https://github.com/Th3Unforg1ven), para Trespasser v2.1.3, Foundry VTT 14 e **Custom System Builder 6.1.2**. Apoie o jogo em https://tundalus.itch.io/trespasser.

**Versão de teste 0.1.0.** Conferido contra o código público do CSB 6.1.2 e testes locais de conversão e fórmulas. Ainda não executado em uma mesa Foundry 14.370; não representa uma integração homologada. Não inclui Foundry, CSB, livros ou compêndios de conteúdo do jogo.

## Instalar

Baixe o [ZIP da versão 0.1.0](https://github.com/Th3Unforg1ven/trespassercs/releases/download/foundry-v0.1.0/trespasser-csb-0.1.0.zip) na [release do GitHub](https://github.com/Th3Unforg1ven/trespassercs/releases/tag/foundry-v0.1.0).

1. Com o Foundry fechado, abra sua pasta de dados de usuário e entre em `Data/modules`.
2. Extraia o ZIP ali. O resultado deve ser `Data/modules/trespasser-csb/module.json`, sem uma pasta duplicada no meio.
3. Abra um mundo que use **Custom System Builder 6.1.2** no Foundry 14.
4. Como mestre, abra **Manage Modules / Gerenciar módulos**, ative **Trespasser · Character & Haven Records (CSB)** e recarregue o mundo.
5. Em **Configure Settings / Configurar ajustes → Module Settings**, procure **Trespasser · Registros / Records** e clique **Abrir / Open**.
6. Escolha Português ou English. Use **Novo personagem**, **Novo refúgio** ou **Importar JSON**. Os templates necessários são instalados automaticamente. **Instalar templates** apenas adiciona os dois modelos à lista de Atores.
7. Na lista de Atores, configure a propriedade da nova ficha para o jogador. A ficha importada começa privada, com propriedade do mestre que a importou.

Alternativa de acesso: crie uma macro do tipo Script contendo `game.modules.get('trespasser-csb').api.open();` e execute como mestre.

## Importar do site

No site, use **Exportar** e baixe o JSON, ou extraia o `.json` do ZIP de PDF + JSON. No painel Trespasser do Foundry selecione esse arquivo e clique **Importar JSON**. Aceita os formatos `trespasser-character` e `trespasser-haven`, versão 1, regras 2.1.3, até 4 MB.

Cada importação cria **um novo Ator**. Não atualiza nem apaga fichas existentes. Nomes, recursos, atributos, treino, aflições, ferimentos, alinhamentos, armas, armaduras, itens mágicos, inventário, feitos, estados e notas são convertidos em campos CSB editáveis. Textos livres são tratados como texto e escapados antes de serem apresentados como conteúdo rico.

O retrato é enquadrado com o zoom e posição do site, convertido para WebP e enviado para `Data/trespasser-portraits` antes de criar o Ator. O mestre precisa ter upload disponível. Se o upload falhar, a importação para e não cria uma ficha sem a imagem. Se a criação do Ator falhar depois do upload, pode sobrar um arquivo de retrato nessa pasta; nenhum arquivo é apagado automaticamente. O enquadramento original permanece no JSON do site. Dentro do Foundry a imagem enquadrada usa o seletor nativo de retrato.

As fichas salvas no Foundry e no site são **independentes**. Não há login Google no módulo, sincronização com Supabase ou exportação de volta para o formato do site. Para backup dos Atores já editados no Foundry, use a exportação JSON do próprio Foundry.

## Usar

- A ficha utiliza os componentes nativos do CSB, com abas e tema de tinta/pergaminho. O tema acompanha as classes claro/escuro do Foundry.
- Atributos, perícias e Precisão têm botões de teste no chat. Em perícias, escolha o atributo adequado à situação; só soma o Skill bonus quando a perícia escolhida está marcada como treinada.
- O dado de perícia pode ser rolado na aba Combate. A iniciativa é oferecida como teste contra TN; o módulo **não muda a regra global de ordenação de combate**.
- PV e valores de combate recalculam a partir de atributos, nível, armadura e bônus. A barra 1 dos tokens vinculados aos personagens criados pelo módulo aponta para PV. Em tokens antigos, selecione `attributeBar.res_hp` manualmente.
- A reserva diária de recuperação é explícita. Perder Endurance não a reduz retroativamente. Focus não recebe teto baseado no valor inicial; Resolve tem limite 3.
- Marcar aflições e estados não aplica efeitos automaticamente. Gastos de feitos, dano de armas, custos crescentes e consequências continuam manuais. Armadura total 6+ retira Agility da Guard, como na ficha web.
- Refúgios incluem perícias, população, evento, construções, projetos, fortalezas, produção, contratados, taxas, despesas e notas. Níveis e avanço são manuais; nenhuma construção aplica bônus automaticamente.
- Templates PT incluem os termos originais. Templates EN ficam em inglês. O idioma é escolhido na criação/importação, não muda automaticamente os rótulos de Atores já criados.
- Templates existentes não são sobrescritos pelo instalador. É possível personalizá-los com o editor do CSB. Para criar uma ficha manualmente pela lista de Atores, escolha o template e use o comando de recarregar template do CSB.

## Templates sem o instalador

`templates/trespasser-pt.json` e `templates/trespasser-en.json` usam o formato **Import templates** do próprio CSB. Não são arquivos de personagem do site. O módulo é necessário para o tema, importação do site e preparação automática do retrato; os campos e fórmulas nativos permanecem nos Atores mesmo se ele for desativado.

## Conferir na primeira mesa

Crie um mundo de teste com CSB 6.1.2 no Foundry 14.370; ative o módulo; importe um personagem e um refúgio; confira abas, campos e rolagens; altere Might e confira PV máximo; altere Endurance e confira que a reserva diária não mudou; arraste o personagem para a cena e altere a barra de PV; reabra a ficha e confira persistência; teste um jogador com propriedade da ficha; confira modos claro/escuro e janela estreita. Esses passos dependem do Foundry e estão pendentes nesta entrega.

## Desenvolvimento

Na raiz do repositório:

```powershell
node --test tests/foundry.test.mjs tests/foundry-runtime.test.mjs
node scripts/check-foundry-csb.mjs tmp/csb-6.1.2
node scripts/build-foundry.mjs
```

O segundo comando usa uma cópia descompactada **do CSB 6.1.2** para conferir componentes, avaliar fórmulas com o math.js do CSB e comparar os resultados com os modelos da ficha. O CSB não é incluído no ZIP. Os modelos do site são copiados pelo build, evitando manter uma segunda implementação independente da validação de dados.

Na entrega inicial: 223 testes do repositório passaram, incluindo 8 testes da adaptação; 3.600 comparações de valores derivados passaram usando o math.js e `lookup()` do CSB; todos os rótulos calculados e 30 expressões de rolagem passaram pelo interpretador real do CSB com backend de dados simulado. A seleção de arquivo, upload de retrato, renderização da ficha, permissões entre usuários e persistência real do Foundry ainda precisam da conferência em mesa descrita acima.

Referências de implementação: [CSB 6.1.2](https://gitlab.com/custom-system-builder/custom-system-builder/-/releases/6.1.2), [módulos Foundry](https://foundryvtt.com/article/module-development/), [DialogV2](https://foundryvtt.com/api/v14/classes/foundry.applications.api.DialogV2.html), [FilePicker](https://foundryvtt.com/api/v14/classes/foundry.applications.apps.FilePicker.html).

As fontes são distribuídas com as respectivas licenças OFL em `assets/fonts`. O código de conversão e os templates deste pacote são próprios; o código do CSB foi consultado para compatibilidade e não é redistribuído.

## English quick start

Extract `trespasser-csb` into your Foundry user-data `Data/modules` directory. Enable the module in a CSB 6.1.2 world on Foundry 14. Open Configure Settings → Module Settings → Trespasser Records → Open. Select English, then create a character/haven or import the JSON exported by the website. Assign actor ownership to the player. Every import creates a new private actor. Website and Foundry saves are separate. This is a test release: live Foundry 14.370 validation is pending.
