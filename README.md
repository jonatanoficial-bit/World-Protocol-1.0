## Versão / Build

O jogo exibe no topo a **Build + data e hora** (para confirmar atualização no GitHub Pages).

## Eventos Cinematográficos

Eventos importantes agora aparecem em modo cinematográfico (overlay fullscreen) com urgência (informativo/alto/crítico) e efeitos de som/typewriter.

## Finais

O jogo termina quando:
- Domínio global ≥ 100% (Vitória)
- Dívida extrema (Colapso Econômico)
- Estabilidade muito baixa + pressão alta (Golpe)
- Ameaça extrema + prontidão militar baixa (Derrota)

A tela de final exibe um resumo da gestão e permite voltar ao Lobby ou iniciar um novo jogo.

## Áudio

O jogo inclui microsons e ambiência via WebAudio (sem arquivos externos). O usuário pode ligar/desligar pelo ícone 🔊/🔇 no HUD.


## Mapas (Online)
O módulo **Mapa Global** utiliza um mapa vetorial gratuito carregado online (Wikimedia Commons – *BlankMap-World.svg*).
Se o usuário estiver offline, o mapa pode não carregar (o overlay e a jogabilidade continuam).

Licença/atribuição: ver a página do arquivo no Wikimedia Commons (CC BY-SA / PD conforme o arquivo).

## Build

Build atual: **1.1.5** (Hotfix: Screens + Intro + Cinematic Events) (Eventos Cinematográficos + Urgência + Cutscene Overlay) (Finais Cinematográficos + Resumo da Gestão) (Cinematics + Sound + Module Identity) (UI AAA Pass + Map Online + Backgrounds fix) (Tech Tree / Pesquisa)

# Estratégia 2030

Este projeto é um protótipo de jogo de estratégia de guerra ambientado em um mundo fictício no ano de 2030. Ele foi pensado para dispositivos móveis (mobile‑first), com uma interface premium digna de um produto AAA, mas também funciona perfeitamente em navegadores de desktop. Todo o código utiliza apenas **HTML**, **CSS** e **JavaScript** puro, sem frameworks.

## Como jogar

1. Baixe ou clone o repositório e abra o arquivo `index.html` em um navegador moderno. Para uma melhor experiência com carregamento de assets locais, recomenda‑se utilizar um pequeno servidor HTTP (ex.: [VS Code Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) ou `python3 -m http.server`).
2. Ao iniciar você verá a tela de *splash* com o logo **Vale Games**. Após alguns segundos, o menu principal aparece com as opções **Novo Jogo** e **Continuar**.
3. Em **Novo Jogo**, informe seu nome e escolha a nação que deseja comandar. O jogo cria um estado inicial com saldo de R$ 1.000.000, tropas zeradas e data de janeiro de 2030. Até três jogos podem ser salvos simultaneamente; os estados são armazenados no `localStorage` do navegador.
4. Após criar o jogo, uma mensagem narrativa (“efeito máquina de escrever”) contextualiza a situação política do país. Clique em **Continuar** para acessar o **Lobby**.
5. No Lobby você encontra quatro áreas principais:
   - **Relações:** gerencie a diplomacia com outras nações. Ainda não há consequências, mas a estrutura está preparada para expansões.
   - **Guerra:** selecione um país para iniciar uma guerra e ajuste o tamanho de Exército, Marinha e Aeronáutica. Cada soldado/navio/avião possui um custo diferente que é debitado do saldo. A interface pode ser expandida para simular batalhas futuramente.
   - **Comércio:** compre e venda recursos como Comida, Petróleo e Armas. Os preços variam a cada visita e as transações afetam diretamente seu saldo e inventário.
   - **Infraestrutura:** invista em setores como Transporte, Saúde, Educação, Pesquisa Científica e Corrida Espacial. Cada investimento custa R$ 100.000; desfazer parte do investimento retorna 70 % do valor.
6. Em **Administração** (`/admin/admin.html`), há uma área administrativa básica. O login padrão é `admin` / `admin`. Após logar é possível cadastrar DLCs fictícias (nome e versão) que são armazenadas em `localStorage`. Este mecanismo demonstra como o projeto está pronto para receber expansões sem alterar o núcleo.

## Estrutura de pastas

```
strategy-game/
├── index.html            # Página principal com menu, criação de jogo e lobby
├── relations.html        # Módulo de diplomacia
├── war.html              # Módulo de guerra
├── commerce.html         # Módulo de comércio
├── infrastructure.html   # Módulo de infraestrutura
├── admin/
│   ├── admin.html        # Área administrativa com login local
│   └── admin.js          # Lógica do painel administrativo
├── css/
│   └── style.css         # Estilos globais responsivos e premium
├── js/
│   ├── main.js           # Controle de telas e estado inicial do jogo
│   ├── relations.js      # Lógica do módulo de relações
│   ├── war.js            # Lógica do módulo de guerra
│   ├── commerce.js       # Lógica do módulo de comércio
│   └── infrastructure.js # Lógica do módulo de infraestrutura
├── assets/
│   ├── images/
│   │   ├── background-main.png           # Fundo do lobby e splash
│   │   ├── background-relations.png      # Fundo do módulo de relações
│   │   ├── background-war.png            # Fundo do módulo de guerra
│   │   ├── background-commerce.png       # Fundo do módulo de comércio
│   │   ├── background-infrastructure.png # Fundo do módulo de infraestrutura
│   │   ├── background-admin.png          # Fundo da área administrativa
│   │   └── icons/
│   │       ├── icon-relations.png
│   │       ├── icon-war.png
│   │       ├── icon-commerce.png
│   │       └── icon-infrastructure.png
│   └── (outras imagens ou fontes)
├── dlc/
│   └── base/
│       └── manifest.json # Manifesto do conteúdo base com nações e missões
└── README.md            # Este documento
```

## Publicação no GitHub Pages

Para publicar no GitHub, crie um repositório e faça o commit de todos os arquivos. Em seguida, habilite o **GitHub Pages** para a branch principal (ou `gh-pages`). Certifique‑se de que `index.html` está na raiz do repositório (como no diretório `strategy-game/`). Após alguns minutos, seu jogo estará disponível no endereço fornecido pelo GitHub.

## DLCs e expansões futuras

O jogo foi projetado com uma estrutura de conteúdo modular. O diretório `dlc/` pode abrigar novas expansões sem alterar o núcleo. Cada expansão deve conter um `manifest.json` com sua própria lista de missões, nações adicionais, regras ou assets. O `admin` demonstra uma forma simples de registrar essas expansões na aplicação. Em versões futuras, poderá ser adicionado um carregador dinâmico de assets que leia arquivos JSON e aplique novas mecânicas.

## Observações

* Este protótipo é uma base sólida para evoluir um jogo complexo: faltam sistemas de combate, IA, eventos aleatórios e balanceamento econômico, mas toda a infraestrutura visual e estrutural está pronta.
* O armazenamento de dados utiliza `localStorage`. Limpar os dados do navegador apagará jogos salvos e DLCs cadastradas.
* As imagens de fundo e ícones foram geradas artificialmente para fins ilustrativos e podem ser substituídas por assets originais conforme necessidade.