# Ponto B — Cut Creator

App irmão do **Editor de Vídeos** da Ponto B. Enquanto o editor cuida da **edição** (headline, legenda, render nos formatos), o Cut Creator cuida da etapa **anterior**: pegar um vídeo longo (aula, live, mentoria de até 40min) e **descobrir quais trechos viram bons cortes** pra Reels, Shorts e ads.

Para cada corte a IA entrega:
- **Título** e **hook** sugeridos
- **Legenda** pronta pro post
- **Motivo** (por que aquele trecho é forte para o público do especialista)
- **In/out** ancorados no áudio (nunca corta no meio de uma frase)
- **Formato sugerido** (Reels, vertical longo, ads)
- **Score** de prioridade

Você assiste no player, refina por prompt (ex: "junta o corte 2 e 3", "foca em objeções"), aprova, e baixa cada corte já recortado em `.mp4` pra subir no editor.

**Stack:** Python (faster-whisper) → Claude Sonnet → ffmpeg (`.mp4` do trecho)

O Cut Creator **não edita** vídeo. Sem Remotion, sem render. Isso é papel do editor.

---

## Início rápido (depois que o setup já foi feito uma vez)

Se você ou alguém da equipe já fez o setup completo na sua máquina, usar o Cut Creator é simples:

1. Vá até a pasta `pontob-cut-creator` no Windows Explorer
2. Dê **dois cliques no arquivo `Iniciar Cortes.bat`**
3. Vai abrir uma janela preta chamada "PontoB Cut Creator Server" — **não feche essa janela**, ela é o servidor rodando
4. Espere cerca de 30 segundos. O navegador vai abrir sozinho em `http://localhost:3100`
5. Quando terminar de usar, é só fechar a janela "PontoB Cut Creator Server"

> **Dica — atalho no Desktop:** na primeira vez que você rodar o `Iniciar Cortes.bat`, ele cria automaticamente um atalho no Desktop chamado "Ponto B - Cut Creator" com o ícone do app. Da próxima vez é só clicar no atalho.

> **Duas instâncias ou mais ao mesmo tempo:** cada clique no atalho abre uma janela nova em uma porta livre próxima (3100, 3101, 3102...) sem conflitar com nada. Rodar o editor (porta 3000) e o Cut Creator (porta 3100) juntos também funciona — são apps independentes.

**Se você nunca fez o setup, siga o passo a passo completo abaixo.** É demorado (umas duas horas na primeira vez), mas você só faz uma vez por máquina.

> **Já tem o Editor de Vídeos rodando?** Ótimo — a maior parte das ferramentas do Passo 0 já está instalada, e você pode até reaproveitar a mesma pasta de transcrição do editor pra não baixar o modelo Whisper de novo (~3GB). Ver seção "Atalho: reusar o Whisper do Editor" mais abaixo.

---

## Como funciona (para entender o que está sendo instalado)

```
[vídeo bruto .mp4 — aula, live, mentoria]
     ↓ faster-whisper (transcrição local com timestamps)
[transcript.json]
     +  perfil do Especialista (público, objetivo, tom)  +  prompt-guia opcional
     ↓ Claude Sonnet (detecta os melhores cortes)
[cuts.json — validado por Zod]
     ↓ ffmpeg (corta o trecho aprovado, sem reencode — ~1s por corte)
[cortes .mp4 pra baixar e subir no Editor de Vídeos]
```

Tudo passa pela interface web em `localhost:3100`. Cada job persiste em `jobs/<job_id>/`.

Para o pipeline funcionar a gente precisa instalar 4 ferramentas no seu computador (passo 0), depois baixar o código do projeto e configurar (passos 1 a 5).

---

## Antes de começar — entendendo o que é "Terminal"

Praticamente todo o setup acontece no **Terminal** (também chamado de "Prompt de Comando", "PowerShell" ou "CMD" no Windows). É uma janela preta onde você digita comandos em vez de clicar em botões. Você cola um comando, aperta Enter, e ele executa.

**Como abrir um Terminal na pasta do projeto (Windows — método mais fácil):**

1. Abra o Windows Explorer
2. Navegue até a pasta onde você quer que o projeto fique (ex: `C:\repos`)
3. Clique uma vez na **barra de endereço** do Explorer (em cima, onde mostra o caminho)
4. Apague o que está escrito ali, digite **`powershell`** e aperte Enter
5. Vai abrir uma janela azul ou preta — esse é o terminal, **já posicionado** na pasta certa

> **Alternativa:** clique com o botão direito **dentro** da pasta segurando a tecla **Shift** → "Abrir janela do PowerShell aqui" (em versões mais antigas do Windows) ou "Abrir no Terminal" (Windows 11).

**Como saber onde o Terminal está agora:** a primeira linha mostra o caminho atual, tipo `PS C:\repos>`. Esse `C:\repos` é a pasta onde você está. Qualquer comando que você rodar vai afetar essa pasta.

**Como colar um comando no Terminal:**

- Copie o comando do README com Ctrl+C como sempre
- Clique dentro da janela do Terminal
- Cole com **clique direito do mouse** (no Windows PowerShell clássico) ou **Ctrl+V** (no Windows Terminal mais novo)
- Aperte **Enter** para executar

**O que esperar quando você rodar um comando:**

- Se aparecer texto descendo na tela, o comando está rodando — é só esperar
- Se voltar pro prompt (`PS C:\repos>`) **sem mensagem de erro vermelha**, deu certo
- Se aparecer texto **vermelho** ou a palavra "Error", algo deu errado — leia a mensagem ou consulte a seção "Problemas comuns" no final deste README

---

## Setup completo — passo a passo (primeira vez)

### Passo 0.0 — Já tem alguma coisa instalada? (COMECE AQUI)

**Se você já usou o Editor de Vídeos da Ponto B nessa máquina, provavelmente já tem tudo instalado.** Antes de sair baixando as 4 ferramentas do Passo 0, cole o comando abaixo num terminal PowerShell pra ver o que tá faltando:

```powershell
$t={param($x)try{iex "$x 2>&1"|select -First 1}catch{}};$c=@(@{n="Node.js";c="node --version";url="https://nodejs.org"},@{n="Python 3.12";c="py -3.12 --version";url="https://www.python.org/downloads/release/python-3128/"},@{n="FFmpeg";c="ffmpeg -version";url="winget install Gyan.FFmpeg (admin)"},@{n="Git";c="git --version";url="https://git-scm.com/download/win"});$c|%{$r=& $t $_.c;if($r){Write-Host "OK   " -F Green -NoNewline;Write-Host "$($_.n)  $r"}else{Write-Host "FALTA" -F Red -NoNewline;Write-Host "  $($_.n) -> $($_.url)"}}
```

Vai mostrar cada ferramenta com **OK** (verde) ou **FALTA** (vermelho + link pra instalar).

- **Tudo OK?** Pule direto pro **Passo 1** (baixar o código).
- **Algo FALTA?** Só faça o subpasso do Passo 0 correspondente:
  - Node.js → 0.1
  - Python 3.12 → 0.2
  - FFmpeg → 0.3
  - Git → 0.5

O **Passo 0.4 (Visual C++ Redistributable)** não aparece nesse check porque não tem um comando simples pra testar. Se o Editor de Vídeos já roda transcrição na sua máquina, você já tem ele — pode pular. Se não tem certeza, é chato mas rápido de instalar por garantia (segue o Passo 0.4 abaixo).

---

### Passo 0 — Instalar as ferramentas básicas no sistema

Só faça os subpassos que ficaram **FALTA** no Passo 0.0 acima. Se todos deram OK, já pode pular pra `Passo 1`.

#### 0.1 — Node.js (motor que roda o site do Cut Creator)

1. Acesse https://nodejs.org
2. Clique no botão **LTS** (versão estável, atualmente 20.x ou superior)
3. Baixe o instalador `.msi` e execute
4. Aceite todas as opções padrão, clique "Next" até o fim
5. **Reinicie o computador** depois da instalação (importante pra ele aparecer no Terminal)

**Como confirmar que instalou:** abra um Terminal (PowerShell) e cole:

```powershell
node --version
```

Aperte Enter. Deve aparecer algo como `v20.11.0`. Se aparecer "comando não reconhecido", reinicie o computador e tente de novo.

#### 0.2 — Python 3.12 (usado pra transcrever o áudio do vídeo)

> **Atenção:** tem que ser a versão **3.12**. As versões 3.13 e 3.14 fazem o transcritor quebrar.

1. Acesse https://www.python.org/downloads/release/python-3128/
2. Role até "Files" e baixe o **Windows installer (64-bit)**
3. Execute o instalador
4. Na primeira tela, **marque a caixa "Add python.exe to PATH"** (importante, senão não funciona no Terminal)
5. Clique em "Install Now" e aguarde
6. Reinicie o computador

**Como confirmar que instalou:** abra um Terminal e cole:

```powershell
py -3.12 --version
```

Deve aparecer `Python 3.12.x`. Se aparecer outra versão ou erro, refaça a instalação garantindo que marcou "Add to PATH".

#### 0.3 — FFmpeg (usado pra recortar os cortes finais)

Abra o Terminal **como Administrador** (clique no Menu Iniciar, digite "PowerShell", clique direito → "Executar como administrador") e cole:

```powershell
winget install Gyan.FFmpeg
```

Aperte Enter. Vai baixar e instalar sozinho — pode demorar alguns minutos. Quando voltar pro prompt, fechou.

**Como confirmar:** feche e reabra o Terminal (não precisa ser como Admin desta vez) e cole:

```powershell
ffmpeg -version
```

Deve aparecer um monte de texto começando com "ffmpeg version...". Se não aparecer, reinicie o computador.

#### 0.4 — Visual C++ Redistributable (dependência da transcrição)

1. Baixe o arquivo daqui: https://aka.ms/vs/17/release/vc_redist.x64.exe
2. Execute o instalador, aceite os termos e clique "Install"
3. Se aparecer mensagem dizendo "Já está instalado", está tudo certo

> Sem isso, a transcrição quebra com erro `DLL load failed while importing onnxruntime_pybind11_state` quando você for usar.

#### 0.5 — Git (pra baixar o código do projeto)

1. Acesse https://git-scm.com/download/win
2. Baixe o instalador (vai começar automático)
3. Execute. Pode clicar "Next" em todas as opções — os padrões são bons
4. Reinicie o computador

**Como confirmar:** abra um Terminal e cole:

```powershell
git --version
```

Deve aparecer `git version 2.x.x`.

#### 0.6 — Liberar execução de scripts no PowerShell (só Windows)

Por segurança, o Windows bloqueia scripts externos por padrão (incluindo o `npm` que vamos usar). Precisa liberar uma vez.

1. Clique no Menu Iniciar, digite "PowerShell"
2. Clique com botão direito em "Windows PowerShell" → **"Executar como administrador"**
3. Cole o comando abaixo e aperte Enter:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

4. Quando aparecer a pergunta, digite **S** e aperte Enter
5. Feche essa janela do PowerShell

---

### Passo 1 — Baixar o código do projeto

#### 1.1 — Escolha onde guardar o projeto

Crie ou escolha uma pasta no seu computador pra ser o "lar" do projeto. Sugerimos `C:\repos` mas pode ser qualquer lugar (Documentos, Desktop, etc.). Só evite caminhos com espaços ou acentos.

Como criar a pasta:
1. Abra o Windows Explorer
2. Navegue até `C:\` (Este Computador → Disco Local C:)
3. Clique com botão direito num espaço vazio → Novo → Pasta
4. Nomeie como `repos` (sem espaço, sem acento)

#### 1.2 — Abra o Terminal **dentro dessa pasta**

Siga o método explicado na seção "Antes de começar — entendendo o que é Terminal":

1. Abra `C:\repos` no Windows Explorer
2. Clique na barra de endereço, apague o que está lá, digite `powershell` e aperte Enter
3. Você deve ver `PS C:\repos>` na janela que abriu

#### 1.3 — Baixe o código

Cole esses 3 comandos **um de cada vez**, apertando Enter entre cada um:

```powershell
git clone https://github.com/barbaracosta-pontob/pontob-cut-creator.git
```

Esse primeiro comando vai baixar o projeto e criar uma pasta nova chamada `pontob-cut-creator` dentro de `C:\repos`. Demora 10–30 segundos.

```powershell
cd pontob-cut-creator
```

Esse comando "entra" na pasta recém-baixada. Você vai ver o prompt mudar pra `PS C:\repos\pontob-cut-creator>`.

```powershell
npm install
```

Esse comando baixa **todas as dependências** do projeto. Pode demorar **5 a 15 minutos** dependendo da sua internet. Vai aparecer muito texto descendo, isso é normal. Espere até voltar o prompt `PS C:\repos\pontob-cut-creator>` sem erros vermelhos.

> Você só precisa fazer o passo 1.3 uma vez. Da próxima vez que abrir o projeto, ele já vai estar baixado.

---

### Passo 2 — Configurar a chave da API do Claude

O Cut Creator usa o Claude (IA da Anthropic) pra detectar os cortes. Você precisa de uma chave de API.

> **Se você já configurou o Editor de Vídeos nesta máquina, pode usar a mesma chave.**

#### 2.1 — Pegue sua chave da API

1. Acesse https://console.anthropic.com/settings/keys
2. Faça login (ou crie uma conta, se ainda não tiver)
3. Clique em **"Create Key"**
4. Dê um nome (ex: "Cut Creator Ponto B") e clique em criar
5. **Copie a chave que aparece — ela começa com `sk-ant-...`**. Você só consegue ver essa chave uma vez. Se perder, tem que criar outra.

#### 2.2 — Crie o arquivo de configuração

No mesmo Terminal que você está (deve estar em `C:\repos\pontob-cut-creator`), cole:

```powershell
copy .env.example .env
```

Isso cria um arquivo chamado `.env` na raiz do projeto, baseado no template.

#### 2.3 — Abra o arquivo `.env` e cole sua chave

1. Abra o Windows Explorer em `C:\repos\pontob-cut-creator`
2. Procure o arquivo `.env` (atenção: ele começa com ponto, então pode estar oculto — se não aparecer, vá em "Exibir" → marque "Itens ocultos")
3. Clique com botão direito → **Abrir com → Bloco de Notas**
4. Procure a linha `ANTHROPIC_API_KEY=` e cole sua chave logo depois do `=`, sem espaço

O arquivo deve ficar assim:

```env
ANTHROPIC_API_KEY=sk-ant-api03-aBcDeFgHi...    # sua chave aqui
CLAUDE_MODEL=claude-sonnet-4-6                  # deixe assim
WHISPER_MODEL=large-v3                          # use "small" para testes mais rápidos
WHISPER_DEVICE=auto                             # auto detecta GPU
JOBS_DIR=./jobs
PORT=3100
```

5. Salve com Ctrl+S e feche o Bloco de Notas.

> **Segurança:** essa chave dá acesso à sua conta da Anthropic e pode gastar seus créditos. Nunca compartilhe esse arquivo `.env` em e-mails, prints ou commits no Git. O projeto já está configurado pra ignorar o `.env`.

---

### Passo 3 — Instalar as dependências do transcritor (Python)

A transcrição do áudio roda em Python separado do resto. Precisamos criar um "ambiente Python isolado" só pra ele. **Use exatamente as mesmas versões do Editor de Vídeos** — as bibliotecas estão travadas em `requirements.txt` porque combinações diferentes fazem a transcrição quebrar em cascata.

> **Atalho: reusar o Whisper do Editor.** Se você já tem o `pontob-video-editor` funcionando nesta máquina, dá pra apontar o Cut Creator pra venv que já existe lá, evitando baixar o modelo Whisper de novo (~3GB) e reinstalar as bibliotecas. Basta adicionar uma linha no `.env`:
>
> ```env
> WHISPER_PYTHON=C:\repos\pontob-video-editor\services\transcription\.venv\Scripts\python.exe
> ```
>
> Ajuste o caminho pro lugar onde o editor está no seu computador. Se preencher isso, **pule o resto do Passo 3**.

Se você **não** quer/não pode reusar a venv do editor, siga os comandos abaixo. No Terminal (em `C:\repos\pontob-cut-creator`), cole **um de cada vez**:

```powershell
cd services\transcription
```

Isso entra na subpasta do transcritor.

```powershell
py -3.12 -m venv .venv
```

Isso cria o "ambiente Python isolado" (`.venv`) usando **especificamente** o Python 3.12. Demora 10–30 segundos.

```powershell
.\.venv\Scripts\pip install -r requirements.txt
```

Isso instala as bibliotecas com as versões travadas. Demora 3–10 minutos e baixa cerca de 500 MB.

```powershell
cd ..\..
```

Isso volta pra raiz do projeto.

> **Atenção sobre o Python 3.12:** o comando `py -3.12` força o uso da versão certa, mesmo que você tenha outras versões instaladas. Se aparecer erro dizendo que "3.12" não foi encontrado, refaça o Passo 0.2.

> Na primeira vez que você usar o Cut Creator, ele vai baixar automaticamente o modelo Whisper (`large-v3`, cerca de 3 GB). Pra evitar esse download durante testes, troque `large-v3` por `small` no arquivo `.env` — usa menos espaço mas a transcrição fica menos precisa.

---

### Passo 4 — Criar a pasta de jobs

O Cut Creator salva cada processamento numa pasta própria dentro de `jobs/`. Crie ela no Terminal (em `C:\repos\pontob-cut-creator`):

```powershell
mkdir jobs
```

A pasta `especialistas/` já vem criada e populada junto com o código — não precisa criar manualmente.

---

### Passo 5 — Abrir o Cut Creator pela primeira vez

Agora que tudo está instalado, **você não vai mais precisar do Terminal pra usar o Cut Creator no dia a dia**. A partir daqui é tudo no clique.

1. Feche o Terminal (pode fechar a janela mesmo)
2. Abra o Windows Explorer em `C:\repos\pontob-cut-creator`
3. Procure o arquivo **`Iniciar Cortes.bat`**
4. **Dê dois cliques nele**
5. Vai abrir uma janela preta chamada "PontoB Cut Creator Server" — **não feche essa janela**, ela é o servidor rodando por trás. Pode minimizar se quiser.
6. Aguarde até 30 segundos. O navegador vai abrir sozinho em `http://localhost:3100` mostrando a tela inicial.

Se o Cut Creator abrir, **o setup está completo, parabéns**.

**O que aconteceu por trás dos panos na primeira execução:**

- O `.bat` criou automaticamente um **atalho no seu Desktop** chamado "Ponto B - Cut Creator", com o ícone do app. Da próxima vez você não precisa nem abrir a pasta do projeto — é só clicar no atalho.
- O servidor está rodando localmente na sua máquina (porta 3100). Ninguém fora da sua máquina consegue acessar.
- Você pode ter o Editor de Vídeos (porta 3000) e o Cut Creator (porta 3100) rodando ao mesmo tempo, cada um na sua janela — são apps independentes.

**Como encerrar o Cut Creator:**

- Feche a aba do navegador (opcional)
- **Feche a janela preta "PontoB Cut Creator Server"** — é isso que de fato para o servidor

**Como abrir o Cut Creator da próxima vez:**

- Opção 1: clique duas vezes no atalho "Ponto B - Cut Creator" no Desktop
- Opção 2: abra a pasta `C:\repos\pontob-cut-creator` e clique no `Iniciar Cortes.bat`
- Ambas as opções fazem a mesma coisa

Na interface você consegue:
- Fazer upload do vídeo (até 40 min)
- Selecionar o especialista cadastrado (público-alvo, tom, objetivo — só CONTEXTO, sem parte visual)
- Adicionar um prompt-guia opcional (ex: "foca em cortes que gerem identificação com a dor do psiquiatra iniciante")
- Ver a lista de cortes detectados com título, hook, motivo e formato sugerido
- Assistir cada corte no player (play em loop dentro do trecho)
- Refinar por prompt (ex: "junta o corte 2 e 3", "quero só os 3 melhores")
- **Baixar o `.mp4` de cada corte** já recortado, pronto pra subir no Editor de Vídeos

---

## Fluxo típico Cut Creator → Editor

1. Aula/live/mentoria de até 40 min → sobe no **Cut Creator**
2. IA transcreve e devolve os melhores cortes (com título/hook/legenda/motivo)
3. Você assiste, refina por prompt, aprova
4. Baixa cada `.mp4` do corte aprovado
5. Sobe cada `.mp4` no **Editor de Vídeos** (`localhost:3000`) pra fazer headline, legenda, música e render nos formatos (9:16 / 16:9 / 1:1)
6. Publica

---

## Estrutura do repositório

```
pontob-cut-creator/
├── apps/
│   └── web/                    # Interface Next.js — upload, revisão, refino, download
├── services/
│   ├── transcription/          # Python + faster-whisper (mesmas versões do Editor)
│   └── analysis/               # Node + Anthropic SDK (Claude detecta os cortes)
├── packages/
│   └── schema/                 # Schema Zod dos cortes (fonte de verdade dos campos)
├── especialistas/              # JSONs de contexto de cada mentor (público, tom, objetivo)
├── jobs/                       # Um subdir por job com vídeo, transcript.json, cuts.json, cuts/<id>.mp4
├── scripts/
│   └── dev-instance.js         # Escolhe porta livre e sobe uma instância
├── Iniciar Cortes.bat          # Launcher do Windows (cria atalho + abre navegador)
├── PontoB_Cortes.ico           # Ícone do atalho
├── .env.example                # Template de variáveis de ambiente
└── .env                        # Suas variáveis locais — não versionar
```

---

## Estratégia para vídeos longos (aulas, mentorias, lives)

O app manda o vídeo inteiro pro Whisper e mostra progresso em tempo real:
- Barra de progresso (% do vídeo transcrito)
- Tempo transcrito / duração total (`45:12 / 2:04:00`)
- Trecho atual da fala em itálico

**Bottleneck é o Whisper na CPU** — o Claude aguenta 2h de transcrição tranquilo. Estimativa aproximada com CPU típica de desktop:

| Duração do vídeo | `large-v3` (CPU) | `small` (CPU) |
|---|---|---|
| 15 min | ~30 min | ~5 min |
| 40 min | ~1h30 | ~10 min |
| 1h | ~2h | ~15 min |
| 2h | ~4h a 7h ❌ | ~25-40 min ✓ |

**Recomendação de modelo:**

- **Vídeos até ~40 min:** `WHISPER_MODEL=large-v3` (padrão) — melhor precisão.
- **Aulas de 1h ou mais:** troque pra `WHISPER_MODEL=small` no `.env`. Ainda pega os cortes bem — a detecção de trechos fortes depende do **sentido e estrutura**, não da precisão em cada palavra rara. O `small` erra mais em jargões técnicos mas mantém o fluxo do discurso.

Se você tem GPU NVIDIA disponível, use `WHISPER_DEVICE=cuda` no `.env` — Whisper acelera 5-10x, `large-v3` volta a ser viável até em aulas de 2h.

---

## Problemas comuns

**`ModuleNotFoundError: No module named 'faster_whisper'`**
→ O `.venv` do Python não foi criado ou está apontando pra outro lugar. Refaça o Passo 3 — ou aponte `WHISPER_PYTHON` no `.env` para uma venv que já funciona (ex: a do Editor).

**`ANTHROPIC_API_KEY não definido`**
→ O `.env` precisa estar na raiz do projeto (`pontob-cut-creator/.env`), não dentro de subpastas. Reinicie o servidor após criar/editar.

**`ffmpeg` não encontrado ao exportar corte**
→ Refaça o Passo 0.3 e reinicie o Terminal. Rode `ffmpeg -version` pra confirmar.

**Primeira transcrição muito lenta**
→ O modelo `large-v3` está sendo baixado (~3 GB). Normal só na primeira vez. Use `WHISPER_MODEL=small` no `.env` para testes rápidos.

**Transcrição falha com `Command failed` e código `3221225477` / `0xC0000005`**
→ Access violation ao carregar o modelo. A `.venv` foi criada com Python 3.13/3.14, que puxa um `ctranslate2 ≥ 4.6` incompatível com a CPU. Recrie a venv com Python 3.12:
```powershell
cd services\transcription
Remove-Item -Recurse -Force .venv
py -3.12 -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
```

**`DLL load failed while importing onnxruntime_pybind11_state` (Windows)**
→ Falta o Visual C++ Redistributable, exigido pelo `onnxruntime` (filtro VAD). Instale o [vc_redist.x64.exe](https://aka.ms/vs/17/release/vc_redist.x64.exe), reinicie o terminal e tente de novo. Teste o import isolado com:
```powershell
.\services\transcription\.venv\Scripts\python -c "import onnxruntime; print('onnx ok')"
```

**"A porta 3100 já está em uso"**
→ Você já tem uma instância rodando. Clique no atalho de novo — o `.bat` sobe a próxima em 3101, 3102, etc., cada uma com sua própria pasta `jobs-instance2/`, `jobs-instance3/`, sem sobrescrever nada.

**Conflito com o Editor de Vídeos**
→ Editor roda em 3000, Cut Creator em 3100. Nunca colidem. Podem ficar abertos juntos.
