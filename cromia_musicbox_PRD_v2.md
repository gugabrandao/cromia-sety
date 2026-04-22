# 🎸 CROMIA MUSICBOX
## Product Requirements Document (PRD)
**v2.0 · Cromia Health · 2026**

> Revisão: Login/Auth · Admin de Setlist · Transposição Avançada · Editor Formatável · Stem Separation via IA

| Plataforma | Stack | Arquitetura | Fase |
|---|---|---|---|
| Web / Mobile | React · Vite · TypeScript · Tailwind | Cloudflare Pages | MVP → v2.0 |

---

## Índice

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Autenticação & Gestão de Conta](#2-autenticação--gestão-de-conta)
3. [Administração de Setlist](#3-administração-de-setlist)
4. [Sistema de Transposição Avançado](#4-sistema-de-transposição-avançado)
5. [Editor de Cifra — Formatação Completa](#5-editor-de-cifra--formatação-completa)
6. [Geração de Backing Track via IA (Stem Separation)](#6-geração-de-backing-track-via-ia-stem-separation)
7. [Funcionalidades — Escopo Completo v2.0](#7-funcionalidades--escopo-completo-v20)
8. [Schema Supabase Completo](#8-schema-supabase-completo)
9. [Fluxo de Automação n8n](#9-fluxo-de-automação-n8n)
10. [Frontend — Telas & Componentes](#10-frontend--telas--componentes)
11. [Roadmap de Desenvolvimento](#11-roadmap-de-desenvolvimento)
12. [Modelo de Negócio & Go-To-Market](#12-modelo-de-negócio--go-to-market)
13. [Critérios de Sucesso](#13-critérios-de-sucesso)

---

## 1. Visão Geral do Produto

### 1.1 O Problema

Todo músico profissional conhece a dor: o show começa em minutos, a cifra está no celular em tamanho ilegível, o PDF não abre, o tablet descarregou, a setlist mudou de última hora e a backing track está em outro dispositivo. Não existe hoje nenhum produto pensado do ponto de vista de quem está no palco — apenas adaptações de ferramentas criadas para estudo.

### 1.2 A Solução — Cromia Musicbox

O Cromia Musicbox é um sistema full-stack que captura cifras automaticamente via WhatsApp, as organiza em setlists inteligentes com controle de evento, e as entrega em um frontend otimizado para uso no palco — com scroll automático, transposição em dois modos, editor de formatação completo, backing tracks integradas e separação de stems via IA.

> 🎯 **Tagline:** A primeira plataforma de cifras construída por músico, para o palco.

### 1.3 Posicionamento de Mercado

| Produto | Foco | Palco? | Auto-fetch? | Stem IA? |
|---|---|---|---|---|
| Cifra Club App | Aprendizado | Parcial | Não | Não |
| Ultimate Guitar | Aprendizado / tabs | Não | Não | Não |
| OnSong (iOS) | Setlist para palco | Sim | Manual | Não |
| Chordify | Detecção de acordes | Não | Não | Não |
| **🎸 Cromia Musicbox** | **Palco + automação total** | **✅ Core** | **✅ WhatsApp** | **✅ Demucs** |

---

## 2. Autenticação & Gestão de Conta

> 🆕 **Seção adicionada na v2.0** — Login, Auth e controle de acesso SaaS

### 2.1 Estratégia de Autenticação

O Musicbox usa o **Supabase Auth** como camada de identidade — solução nativa ao stack, sem dependência de serviço externo. Toda a tabela `musicbox_setlist` usa `user_id` como foreign key para `auth.users`, garantindo isolamento total de dados entre usuários em nível de banco de dados via **RLS (Row Level Security)**.

### 2.2 Métodos de Login

- Email + senha como método padrão (essencial para SaaS B2B)
- Magic link (link de acesso enviado por email) — alternativa sem senha
- Google OAuth — login social para reduzir fricção no onboarding
- WhatsApp OTP — opcional na Fase 2: código enviado no próprio WhatsApp (alinhado com o canal de entrada do produto)

### 2.3 Fluxos de Acesso

**Onboarding (novo usuário)**

1. Tela de cadastro: nome, email, senha + seleção de plano
2. Email de confirmação (Supabase Auth nativo)
3. Tela de boas-vindas com tutorial de como enviar a primeira música no WhatsApp
4. Criação automática de primeira setlist "Meu Primeiro Setlist"

**Login recorrente**

1. Email/senha ou Google OAuth
2. Redirecionamento para o Dashboard (lista de setlists)
3. Sessão persistente por 30 dias (refresh token automático)

### 2.4 Controle de Acesso por Plano (RLS + Feature Flags)

| Feature | Free | Artista | Banda | Pro |
|---|---|---|---|---|
| Músicas na biblioteca | 20 | Ilimitado | Ilimitado | Ilimitado |
| Setlists | 1 | Ilimitado | Ilimitado | Ilimitado |
| Usuários simultâneos | 1 | 1 | 8 | Ilimitado |
| Backing tracks | Não | Não | Sim (1GB) | Sim (10GB) |
| Stem separation (IA) | Não | 5/mês | 20/mês | Ilimitado |
| Compartilhamento setlist | Não | Read-only | Edit | Sim + white label |
| Controle remoto PWA | Não | Sim | Sim | Sim |

### 2.5 Área Minha Conta

- Gerenciamento de perfil: nome, foto, instrumento principal
- Assinatura: plano atual, data de renovação, botão de upgrade
- Billing: histórico de pagamentos (integração Stripe ou Pagar.me para BR)
- Dispositivos: sessões ativas, logout remoto
- Preferências: idioma, tom padrão, instrumento padrão para transposição

---

## 3. Administração de Setlist

> 🆕 **Seção expandida na v2.0** — Setlist como entidade de evento completa

### 3.1 O Conceito de Setlist como Evento

No Cromia Musicbox, uma Setlist não é apenas uma lista de músicas — é o **registro completo de um evento musical**. Ela carrega o contexto do show, da missa, do ensaio ou da apresentação, incluindo data, local, tempo disponível e notas de produção. Isso transforma o produto de uma ferramenta de consulta em um sistema de gestão de repertório profissional.

### 3.2 Schema da Tabela `musicbox_setlists`

```sql
CREATE TABLE musicbox_setlists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id),

  -- Identidade do evento
  name            TEXT NOT NULL,           -- 'Show Aniversário Bar X'
  description     TEXT,                    -- notas livres do evento
  event_type      TEXT,                    -- 'show','ensaio','worship','casamento','formatura'
  color_theme     TEXT DEFAULT '#6B21A8',  -- cor visual da setlist
  cover_image_url TEXT,                    -- imagem de capa

  -- Dados do evento
  event_date      DATE,
  event_time      TIME,
  venue_name      TEXT,                    -- nome do local
  venue_address   TEXT,
  duration_min    INTEGER,                 -- tempo total disponível em minutos
  estimated_min   INTEGER,                 -- calculado: soma das durações das músicas

  -- Controle
  is_shared       BOOLEAN DEFAULT false,
  share_token     TEXT UNIQUE,             -- token para link de compartilhamento
  share_mode      TEXT DEFAULT 'view',     -- 'view' | 'edit'
  status          TEXT DEFAULT 'active',   -- 'active' | 'archived' | 'template'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 Interface de Administração de Setlist

**Dashboard de Setlists**

- Cards visuais com: nome do evento, data, tipo de evento, quantidade de músicas, duração estimada vs. duração disponível
- Filtros: por tipo de evento, data, status (ativo/arquivado)
- Busca por nome de setlist ou evento
- Indicador visual de "setlist incompleta" (duração estimada < duração do evento)

**Criação / Edição de Setlist**

- Nome do evento (campo principal, com placeholder inteligente: "Show no Bar X — Sábado")
- Tipo de evento: Show, Ensaio, Worship, Casamento, Formatura, Aniversário, Outro
- Data e hora do evento com seletor de calendário
- Local do evento (nome + endereço opcional)
- Duração disponível em minutos ("Quantos minutos você tem no palco?")
- Descrição livre para notas de produção (rider, contato do produtor, etc.)
- Cor de identificação visual da setlist (color picker com paleta pré-definida)
- Imagem de capa (upload ou URL)

### 3.4 Gerenciador de Músicas na Setlist (Drag & Drop)

O coração da administração de setlist é o gerenciador de ordem das músicas. O design deve priorizar velocidade e intuitividade — um músico reorganiza setlist no camarim 10 minutos antes do show.

**Comportamento do Drag & Drop**

- Biblioteca de implementação: **dnd-kit** (leve, acessível, compatível com touch)
- Drag handle visual no lado esquerdo de cada item (ícone ⋮⋮)
- Preview de posição durante o arraste com linha de inserção animada
- Suporte a touch (arrastar no tablet/celular com o dedo)
- Atalho de teclado: Espaço para selecionar, setas para mover — acessibilidade
- Reordenamento salvo automaticamente no Supabase com debounce de 500ms

**Card de Música na Setlist**

- Número de ordem na setlist (atualiza em tempo real ao reorganizar)
- Título e artista
- Tom de performance atual (com botões inline +/- semitom)
- BPM e duração estimada
- Color tag visual (bolinha colorida personalizável por música)
- Status de backing track: ícone de áudio se tiver faixa carregada
- Menu de ação rápida: editar, duplicar, remover da setlist

**Barra de Status da Setlist**

- Total de músicas
- Tempo estimado vs. tempo disponível — com indicador de cor (🟢 ok · 🟡 apertado · 🔴 passou do tempo)
- Botão "Iniciar Show" que abre o Stage Mode na primeira música

---

## 4. Sistema de Transposição Avançado

> 🆕 **Seção adicionada na v2.0** — Dois modos de transposição independentes

### 4.1 O Problema que esta feature resolve

Quando uma cifra é importada em Dó (C) e o músico transpõe 2 semitons para tocar em Ré (D), os acordes exibidos mudam para `D | A | G | A`. Mas se ele quiser editar a cifra nesse estado, o editor opera internamente no tom original (C), tornando confusa a referência visual. O Cromia Musicbox resolve isso com **dois modos completamente distintos** de transposição.

### 4.2 Modo 1 — Transposição de Performance (Não-Destrutiva)

**O que é**

Transpõe visualmente os acordes na tela sem alterar o conteúdo salvo. O sistema mantém o tom original armazenado e aplica um offset de semitons apenas na renderização. Ideal para decidir o tom no palco ou durante o ensaio.

**Comportamento**

- Botões `+1` / `-1` semitom disponíveis na StageView e no editor
- Indicador permanente: `Tom original: C  |  Tocando em: D  (+2)`
- O offset é salvo por música (campo `transpose_steps` na tabela)
- A cifra pode ser editada no tom original sem confusão — o editor sempre mostra o conteúdo real salvo
- Reset com um clique: volta ao tom original

> 💡 **Caso de uso:** músico ensaia em C, descobre que fica melhor em D. Transpõe +2 para o show. O arquivo original permanece em C para referência.

### 4.3 Modo 2 — Tom Definitivo (Destrutivo — com confirmação)

**O que é**

Reescreve permanentemente todos os acordes da cifra no novo tom. Após esta operação, o tom original é atualizado para o novo tom e o offset zerado. Ideal quando o músico decide definitivamente tocar a música em outro tom e quer editar a cifra nesse tom sem confusão.

**Comportamento**

- Acessível via botão "Definir como Tom Definitivo" no editor de música
- Modal de confirmação com preview: mostra os primeiros 4 acordes antes e depois da conversão
- Ao confirmar: `content_raw` e `content_json` são reescritos com os acordes no novo tom
- `original_key` é atualizado para o novo tom; `transpose_steps` volta a 0
- Histórico de versões preservado: versão anterior fica salva para reversão
- Após a operação, o editor abre no novo tom — edição imediata sem confusão de referência

> ⚠️ **Tom Definitivo é uma operação destrutiva.** O sistema mantém a versão anterior no histórico por 30 dias para possível reversão.

### 4.4 Algoritmo de Transposição

Implementado em TypeScript puro no frontend, sem dependência externa:

```typescript
const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT_MAP  = { 'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B' };

function transposeChord(chord: string, steps: number): string {
  // Normaliza bemóis para sustenidos
  // Extrai nota raiz + sufixo (m, 7, maj7, sus2, add9...)
  // Aplica offset no array cromático com wrap-around
  // Preserva barras de baixo (C/G → D/A ao transpor +2)
}
```

**Lógica de Display**

- Preferência por sustenidos (`#`) ou bemóis (`b`) configurável por usuário
- Acorde de barra preservado: `C/E` transposto +2 vira `D/F#`
- Acordes com extensões preservados: `Cmaj7` → `Dmaj7`, `Am7` → `Bm7`

---

## 5. Editor de Cifra — Formatação Completa

> 🆕 **Seção expandida na v2.0** — Formatação tipográfica completa + sistema de seções visuais

### 5.1 Filosofia do Editor

O editor do Cromia Musicbox deve ser o melhor editor de cifras já construído. Cada elemento é formatável individualmente — acordes, letras e seções têm controles independentes de fonte, tamanho e cor. O sistema de seções visuais vai além dos labels e cria identidade visual para cada parte da música, facilitando a leitura no palco.

### 5.2 Controles de Formatação Global

**Tipografia**

- Família de fonte para acordes (padrão: monospace — JetBrains Mono ou Fira Code)
- Família de fonte para letras (padrão: sans-serif — Inter ou Plus Jakarta Sans)
- Opções de fonte curadas: conjunto de ~8 fontes testadas para leitura no palco
- Tamanho de fonte para acordes (12–72px, controle por slider)
- Tamanho de fonte para letras (12–72px, controle por slider)
- Espaçamento entre linhas: compact / normal / relaxed / muito espaçado

**Cores**

- Cor dos acordes — padrão: amarelo `#FCD34D` (alta visibilidade em fundo escuro)
- Cor da letra — padrão: branco `#F9FAFB`
- Cor de fundo da cifra — padrão: preto `#0F0F1A`
- Color picker com paletas pré-definidas para palco (alto contraste) e estudo (fundo claro)

### 5.3 Sistema de Seções Visuais

Cada seção da música tem um tipo que define sua aparência visual. O músico aplica o tipo com um clique e o sistema formata automaticamente.

| Tipo de Seção | Ícone | Identidade Visual | Comportamento |
|---|---|---|---|
| **Refrão** | 🔴 chorus | Linha lateral esquerda contínua + fundo levemente destacado + label em negrito maior | Toda a extensão do refrão fica com uma **barra vertical colorida à esquerda** — referência visual imediata no palco |
| Verso | 🟢 verse | Label sutil, sem destaque de fundo | Visual limpo, deixa o refrão se destacar por contraste |
| Ponte | 🟡 bridge | Label em itálico + cor diferenciada | Indica mudança harmônica importante |
| Intro | 🔵 intro | Label + separador visual acima | Delimita claramente o início |
| Solo | 🟣 solo | Label + fundo diferente + ícone de guitarra | Sinaliza que é um trecho instrumental |
| Pré-Refrão | 🟠 pre-chorus | Label menor, fundo intermediário | Sinaliza a transição para o refrão |
| Outro / Coda | ⚪ outro | Label final, linha acima e abaixo | Delimita o encerramento da música |
| Personalizado | 🎨 custom | Cor e nome definidos pelo músico | Liberdade total para nomenclaturas específicas |

> 🎯 **O detalhe da linha lateral à esquerda no refrão** é a solução visual mais limpa para o palco: o músico identifica o refrão instantaneamente sem precisar ler o label, mesmo com a tela a 1,5m de distância.

### 5.4 Toolbar do Editor

**Barra de Formatação Rápida (fixada no topo do editor)**

- Grupo Seção: botões `Verso | Refrão | Ponte | Intro | Solo | Pré-Refrão | Coda | Custom`
- Grupo Fonte Acordes: família + tamanho + cor
- Grupo Fonte Letra: família + tamanho + cor
- Grupo Visual: espaçamento + fundo + reset para padrão
- Botão "Pré-visualizar no Palco" — abre StageView em modal com a cifra atual

**Barra de Ação da Linha (aparece ao clicar em uma linha da cifra)**

- Identificar como: acorde / letra / label de seção / tablatura / nota
- Formatar apenas esta linha (override local de fonte e cor)
- Inserir linha acima / abaixo
- Deletar linha

### 5.5 Pré-definições de Tema (Presets)

| Preset | Fundo | Acordes | Letra | Ideal para |
|---|---|---|---|---|
| 🎸 Rock Stage | `#0F0F1A` preto | `#FCD34D` amarelo | `#FFFFFF` branco | Palco noturno, alto contraste |
| 🙏 Worship | `#1E1B4B` azul escuro | `#A78BFA` lilás | `#E0E7FF` azul claro | Cultos, boa leitura distante |
| ☀️ Dia / Estudo | `#FFFFFF` branco | `#7C3AED` roxo | `#111827` preto | Ensaio com luz natural |
| 🎹 Clássico | `#FAF9F6` creme | `#1D4ED8` azul | `#1F2937` cinza | Partitura estilo tradicional |
| 🔥 Neon | `#0A0A0A` preto | `#39FF14` neon verde | `#FF6FFF` rosa | Shows de música eletrônica |

---

## 6. Geração de Backing Track via IA (Stem Separation)

> 🆕 **Seção adicionada na v2.0** — Separação de stems com Demucs (open source, free) a partir de link do YouTube

### 6.1 Viabilidade Técnica — Conclusão da Pesquisa

A ideia é **100% viável** e a melhor solução é o **Demucs**, desenvolvido pelo Meta AI Research. Não é o Suno (que *gera* música nova), mas sim uma ferramenta de **separação de fontes de áudio** — pega uma música existente e extrai apenas a bateria/percussão ou qualquer stem desejado.

| Opção | Custo | Qualidade | Viabilidade para Musicbox |
|---|---|---|---|
| **Demucs (Meta AI) — self-hosted** | Grátis (MIT License) | ⭐⭐⭐⭐⭐ | Ideal: grátis, open source, aceita YouTube URL, entrega drums isolado |
| StemSplit API | Pay-per-use ~$0.025/música | ⭐⭐⭐⭐⭐ | Ótima para começar sem infraestrutura GPU — usa Demucs por baixo |
| Replicate API (Demucs) | ~$0.025/run | ⭐⭐⭐⭐⭐ | Alternativa ao StemSplit — mesma qualidade, mais controle via API |
| Suno AI | Pago / gera música nova | ⭐⭐⭐ | ❌ Não serve: Suno *cria* música, não separa stems de músicas existentes |

> ✅ **Estratégia recomendada:** Fase 2 começa com a API do StemSplit ou Replicate (zero infraestrutura). Fase 3: se o volume justificar, migrar para Demucs self-hosted em servidor com GPU (VPS com NVIDIA T4 — ~$50/mês na AWS/Hetzner).

### 6.2 Fluxo da Feature no Produto

**Etapa 1 — Input do usuário**

Na tela de edição da música, seção "Backing Track":

- Campo: cole o link do YouTube da música
- Seletor de stems a extrair (multi-select):
  - Somente bateria (drums only) — padrão
  - Bateria + baixo (rhythm section)
  - Instrumental completo (sem vocal)
  - Somente vocais (para ensaio)
  - Stems separados — todos os 4: vocal, bateria, baixo, outros

**Etapa 2 — Processamento (assíncrono)**

1. n8n recebe o YouTube URL + configuração de stems escolhida
2. n8n chama a API do Replicate ou StemSplit com o URL
3. API faz o download do áudio do YouTube internamente
4. Demucs processa: separa os stems selecionados (leva 30s–3min dependendo da duração)
5. Webhook notifica n8n quando o processamento termina
6. n8n faz download do stem e salva no Supabase Storage
7. Supabase Realtime notifica o frontend: backing track disponível
8. Frontend exibe player de áudio na tela da música

**Etapa 3 — UX durante o processamento**

- Barra de progresso com status: "Analisando áudio... Separando bateria... Finalizando..."
- Notificação push (ou WhatsApp) quando a backing track estiver pronta
- Processamento não bloqueia o uso do app — o músico pode continuar editando outras músicas

### 6.3 Player de Backing Track no Stage Mode

- Play/pause integrado na StageView — não abre outro app
- Volume independente da backing track
- Loop automático opcional
- Countdown de 2 compassos antes do play ("2... 1... GO") sincronizado com o BPM da música
- Modo "Clique + Backing": toca um metrônomo junto com a backing track
- Se o usuário tiver múltiplas faixas (drums only + full instrumental), pode alternar durante o show

### 6.4 Considerações Legais

> ⚠️ A separação de stems de músicas protegidas por copyright é uma área juridicamente cinza. O Musicbox não armazena as músicas originais — apenas os stems gerados, que são de uso privado do músico. Recomenda-se consultar advogado especializado antes do lançamento público da feature.

---

## 7. Funcionalidades — Escopo Completo v2.0

### Grupo A — Infraestrutura (Fase 0)

- **F00-A:** Schema Supabase completo (`musicbox_setlists` + `musicbox_setlist`)
- **F00-B:** Supabase Auth com RLS em todas as tabelas
- **F00-C:** Feature flags por plano (tabela `user_plans` + middleware de acesso)
- **F00-D:** Workflow n8n de captura WhatsApp → Supabase

### Grupo B — MVP Core (Fase 1)

- **F01:** Captura automática via WhatsApp com LLM parse
- **F02:** Visualizador de cifra para palco (ChordSheet + StageView)
- **F03:** Admin de Setlist com dados de evento completos
- **F04:** Drag & Drop de músicas na setlist
- **F05:** Editor de cifra com sistema de seções visuais
- **F06:** Formatação completa (fonte, tamanho, cor) por elemento
- **F07:** Transposição de Performance (não-destrutiva, +/- semitom)
- **F08:** Login/Auth (email + Google OAuth)

### Grupo C — Diferencial (Fase 2)

- **F09:** Tom Definitivo (transposição destrutiva com histórico)
- **F10:** Backing Track upload e player no Stage Mode
- **F11:** Stem Separation via Demucs/StemSplit API (YouTube → drum stem)
- **F12:** Modo Controle Remoto (PWA celular como pedalboard)
- **F13:** Compartilhamento de setlist por link

### Grupo D — Escala (Fase 3+)

- **F14:** Multi-usuário e banda em tempo real
- **F15:** Demucs self-hosted (quando volume justificar)
- **F16:** Integração Spotify para BPM automático
- **F17:** Sugestão automática de setlist por gênero/duração
- **F18:** Histórico de shows (analytics: quais músicas foram mais tocadas)

---

## 8. Schema Supabase Completo

### 8.1 `musicbox_setlists` (evento)

```sql
CREATE TABLE musicbox_setlists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id),

  -- Identidade do evento
  name            TEXT NOT NULL,
  description     TEXT,
  event_type      TEXT,                    -- 'show','ensaio','worship','casamento','formatura'
  color_theme     TEXT DEFAULT '#6B21A8',
  cover_image_url TEXT,

  -- Dados do evento
  event_date      DATE,
  event_time      TIME,
  venue_name      TEXT,
  venue_address   TEXT,
  duration_min    INTEGER,                 -- tempo total disponível em minutos
  estimated_min   INTEGER,                 -- calculado: soma das durações das músicas

  -- Controle
  is_shared       BOOLEAN DEFAULT false,
  share_token     TEXT UNIQUE,
  share_mode      TEXT DEFAULT 'view',     -- 'view' | 'edit'
  status          TEXT DEFAULT 'active',   -- 'active' | 'archived' | 'template'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.2 `musicbox_setlist` (músicas)

```sql
CREATE TABLE musicbox_setlist (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id),
  setlist_id        UUID REFERENCES musicbox_setlists(id) ON DELETE CASCADE,
  position          INTEGER NOT NULL DEFAULT 0,

  -- Identificação
  title             TEXT NOT NULL,
  artist            TEXT NOT NULL,
  slug_artist       TEXT,
  slug_song         TEXT,
  source            TEXT DEFAULT 'cifraclub',
  source_url        TEXT,

  -- Conteúdo da cifra
  content_raw       TEXT,
  content_html      TEXT,
  content_json      JSONB,                 -- seções parseadas
  lyrics_only       TEXT,
  content_versions  JSONB,                 -- histórico de versões (array, máx 5)

  -- Metadados musicais
  original_key      TEXT,
  performance_key   TEXT,
  transpose_steps   INTEGER DEFAULT 0,
  capo              INTEGER DEFAULT 0,
  bpm               INTEGER,
  time_signature    TEXT DEFAULT '4/4',
  duration_sec      INTEGER,
  difficulty        TEXT,
  transpose_pref    TEXT DEFAULT 'sharps', -- 'sharps' | 'flats'

  -- Formatação visual
  theme_preset      TEXT DEFAULT 'rock_stage',
  chord_font        TEXT DEFAULT 'JetBrains Mono',
  chord_font_size   INTEGER DEFAULT 20,
  chord_color       TEXT DEFAULT '#FCD34D',
  lyric_font        TEXT DEFAULT 'Inter',
  lyric_font_size   INTEGER DEFAULT 18,
  lyric_color       TEXT DEFAULT '#F9FAFB',
  bg_color          TEXT DEFAULT '#0F0F1A',
  line_spacing      TEXT DEFAULT 'normal',

  -- Scroll e palco
  scroll_speed      INTEGER DEFAULT 50,
  auto_scroll       BOOLEAN DEFAULT false,
  show_tabs         BOOLEAN DEFAULT true,

  -- Mídia
  youtube_url       TEXT,
  backing_track_url TEXT,
  backing_tracks    JSONB,                 -- múltiplas faixas
  stem_job_id       TEXT,                  -- ID do job no Replicate/StemSplit
  stem_status       TEXT DEFAULT 'none',   -- none | processing | done | error

  -- Notas e tags
  notes             TEXT,
  color_tag         TEXT,

  -- Controle
  status            TEXT DEFAULT 'active',
  fetch_status      TEXT DEFAULT 'pending',
  fetch_error       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.3 Políticas RLS

```sql
-- Usuário só vê e edita seus próprios dados
ALTER TABLE musicbox_setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE musicbox_setlist  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_setlists" ON musicbox_setlists
  USING (user_id = auth.uid());

CREATE POLICY "own_songs" ON musicbox_setlist
  USING (user_id = auth.uid());

-- Leitura pública para setlists compartilhadas
CREATE POLICY "shared_setlists_read" ON musicbox_setlists
  FOR SELECT USING (is_shared = true);
```

### 8.4 Índices Recomendados

```sql
CREATE INDEX idx_setlists_user_id    ON musicbox_setlists(user_id);
CREATE INDEX idx_setlists_event_date ON musicbox_setlists(event_date);
CREATE INDEX idx_songs_setlist_id    ON musicbox_setlist(setlist_id);
CREATE INDEX idx_songs_user_id       ON musicbox_setlist(user_id);
CREATE INDEX idx_songs_position      ON musicbox_setlist(setlist_id, position);
```

---

## 9. Fluxo de Automação n8n

### 9.1 Pipeline de Captura (WhatsApp → Supabase)

1. Webhook recebe mensagem do WhatsApp Cloud API via Chatwoot
2. Filtro: mensagem contém padrão "Música - Artista" ou variações
3. Code node: passa texto para Claude API com prompt de normalização
4. LLM retorna JSON: `{ title, artist, slug_song, slug_artist }`
5. HTTP Request GET: `cifraclub.com.br/{slug_artist}/{slug_song}/`
6. Code node (cheerio/regex): extrai `content_raw`, `content_html`, `youtube_url`
7. Upsert na tabela `musicbox_setlist` com `fetch_status = 'success'`
8. HTTP Request para Chatwoot: envia confirmação ao usuário no WhatsApp

### 9.2 Tratamento de Erros

- Música não encontrada no Cifra Club → tenta busca por Google (`site:cifraclub.com.br {query}`)
- Segundo fallback: Ultimate Guitar
- Se todos falham → salva com `fetch_status = 'error'` e solicita URL manual ao usuário
- Rate limiting: delay de 2s entre requests

### 9.3 Prompt de Normalização (Claude)

```
Você recebe uma mensagem de WhatsApp de um músico.
Extraia o título da música e o nome do artista.
Retorne APENAS um JSON válido, sem markdown, sem explicação:
{
  "title": "November Rain",
  "artist": "Guns N' Roses",
  "slug_song": "november-rain",
  "slug_artist": "guns-n-roses"
}
Slugs: minúsculo, espaços → hífens, sem acentos, sem caracteres especiais.
```

### 9.4 Pipeline de Stem Separation

1. Usuário cola link do YouTube + seleciona stems desejados
2. Frontend salva `stem_status = 'processing'` + `stem_job_id` no Supabase
3. n8n chama Replicate API: `POST /predictions` com o YouTube URL
4. Webhook do Replicate notifica n8n quando termina
5. n8n faz download do stem gerado
6. n8n faz upload para Supabase Storage em `backing-tracks/{user_id}/{song_id}/`
7. n8n atualiza `backing_track_url` e `stem_status = 'done'`
8. Supabase Realtime notifica frontend
9. n8n envia mensagem WhatsApp: "Sua backing track de [música] está pronta! 🎶"

---

## 10. Frontend — Telas & Componentes

### 10.1 Estrutura de Rotas

| Rota | Tela | Descrição |
|---|---|---|
| `/` | Dashboard | Lista de setlists com cards de evento |
| `/login` | Login | Email/senha + Google OAuth |
| `/signup` | Cadastro | Criação de conta + seleção de plano |
| `/account` | Minha Conta | Perfil, assinatura, preferências |
| `/setlist/new` | Nova Setlist | Formulário de criação de evento |
| `/setlist/:id` | Setlist View | Admin com drag & drop de músicas |
| `/song/:id` | Song Editor | Edição de cifra, metadados e formatação |
| `/stage/:setlist_id` | Stage Mode | Modo palco full-screen |
| `/stage/:setlist_id/:song_id` | Stage Song | Cifra individual no palco |
| `/remote/:setlist_id` | Remote Control | PWA controle pelo celular |

### 10.2 Componentes Principais

**`<ChordSheet />`** — O coração do produto

- Renderiza cifra em formato acorde-sobre-letra com espaçamento preciso
- Suporte a tablatura com fonte monoespaçada
- Seções com identidade visual: barra lateral no refrão, cores por tipo
- Acordes clicáveis: abre diagrama do acorde em tooltip
- Props: `content_json`, `fontSize`, `transpose`, `showTabs`, `theme`, `highlightSection`

**`<StageView />`** — Tela do palco

- Layout full-screen com fundo escuro por padrão
- Header fixo: título, artista, tom atual, BPM, posição na setlist
- Scroll automático com controle de velocidade
- Gestos: swipe left/right para próxima/anterior música
- Botão de tap tempo para ajuste de BPM ao vivo
- Atalhos de teclado: `→` próxima · `←` anterior · `Space` play/pause scroll

**`<SetlistEditor />`** — Administração de setlist

- Formulário de evento completo (data, local, duração, tipo)
- Lista de músicas com drag & drop (dnd-kit)
- Barra de status: duração estimada vs. disponível
- Botão "Iniciar Show"

**`<ChordEditor />`** — Editor de cifra

- Toolbar de formatação fixada no topo
- Seletor de seção por linha
- Preview em tempo real no Stage Mode

**`<BackingTrackPlayer />`** — Player integrado

- Play/pause, progresso, volume
- Countdown sincronizado com BPM
- Alternância entre múltiplas faixas

### 10.3 Design System

| Token | Valor | Uso |
|---|---|---|
| `brand.dark` | `#0F0F1A` | Background do modo palco |
| `brand.purple` | `#6B21A8` | Ações primárias, CTAs |
| `brand.accent` | `#A855F7` | Highlights, seções da cifra |
| `chord.yellow` | `#FCD34D` | Cor padrão dos acordes (preset Rock Stage) |
| `lyric.white` | `#F9FAFB` | Cor padrão da letra no palco |
| `section.green` | `#34D399` | Labels de seção (verde esmeralda) |
| `chorus.line` | `#A855F7` | Barra lateral esquerda do refrão |

---

## 11. Roadmap de Desenvolvimento

| Fase | Prazo | Entregas | Status |
|---|---|---|---|
| **Fase 0** | Semana 1 | Schema Supabase completo + RLS · Supabase Auth configurado · Workflow n8n de captura e parse | 🟡 Em progresso |
| **Fase 1 — MVP** | Semanas 2–4 | React/Vite/TS setup · Auth flows · Dashboard setlists · Admin setlist com dados de evento · Drag & drop · ChordSheet · StageView básico · Editor com seções visuais · Transposição Modo 1 | ⬜ Planejado |
| **Fase 2** | Semanas 5–7 | Tom Definitivo · Formatação completa + presets · Backing track upload + player · Stem Separation via API · Controle remoto PWA · Compartilhamento de setlist | ⬜ Planejado |
| **Fase 3** | Semanas 8–10 | Multi-usuário e banda · Billing Stripe/Pagar.me · Notificações realtime · Analytics básico | ⬜ Planejado |
| **Fase 4** | Mês 3+ | Demucs self-hosted · App mobile nativo · Sugestão automática de setlist · Histórico de shows | ⬜ Futuro |

---

## 12. Modelo de Negócio & Go-To-Market

### 12.1 Segmentos de Clientes

- **B2C Individual:** músicos profissionais e semi-profissionais
- **B2C Banda:** plano para 3–8 músicos com setlists compartilhadas
- **B2B Escola de Música:** gestão de repertório de alunos e professores
- **B2B Worship / Igreja:** repertório litúrgico com múltiplos instrumentistas
- **B2B Casa de Show / Evento:** backstage digital para house bands

### 12.2 Tabela de Preços

| Plano | Preço/mês | Para quem | Destaques |
|---|---|---|---|
| Free | Grátis | Músico iniciante | 20 músicas, 1 setlist, sem stem |
| **Artista** | R$ 29,90 | Músico profissional solo | Ilimitado + 5 stems/mês + controle remoto |
| **Banda** | R$ 79,90 | Banda (até 8 usuários) | + backing tracks + 20 stems/mês + realtime |
| **Pro / Igreja** | R$ 149,90 | Ensembles, worship, escolas | Usuários ilimitados + stems ilimitados |

### 12.3 Canais de Aquisição

- **WhatsApp como produto:** o próprio fluxo de captura é o canal de onboarding ("manda o nome da música e pronto")
- **YouTube / TikTok:** demonstrações no palco ao vivo — músico para músico
- **Comunidades:** grupos de músicos no WhatsApp, Facebook, Discord (worship, covers)
- **Parceiros:** escolas de música, fabricantes de instrumentos, estúdios
- **Indicação:** plano gratuito desbloqueado por cada amigo convidado

### 12.4 Diferencial Competitivo Sustentável

> 🔑 **Três diferenciais combinados que nenhum concorrente tem:**
>
> 1. **WhatsApp como canal de captura** — cria hábito de uso orgânico que nenhum concorrente tem
> 2. **Editor de palco com formatação profissional** — resolve a dor do músico que fica confuso com cifras mal formatadas no escuro
> 3. **Stem separation integrada** — elimina a necessidade de 3 apps diferentes para montar uma backing track

Os dados de setlist gerados pelos usuários criam um **ativo proprietário**: quais músicas são tocadas juntas, em que tons, em que BPMs — inteligência que pode alimentar sugestões automáticas de setlist, precificação dinâmica e parcerias com gravadoras e distribuidoras.

---

## 13. Critérios de Sucesso (MVP)

| Métrica | Meta MVP (30 dias) | Meta v1.0 (90 dias) |
|---|---|---|
| Músicas capturadas com sucesso | > 90% de taxa de sucesso | > 95% |
| Tempo de captura (WhatsApp → tela) | < 8 segundos | < 4 segundos |
| Usuários ativos semanais | 5 músicos beta | 50 músicos pagantes |
| NPS (satisfação no palco) | — (beta) | > 50 |
| Churn mensal | — (beta) | < 10% |
| Stems gerados com sucesso | — | > 85% |

---

*Cromia Musicbox · PRD v2.0 · Cromia Health · 2026*
*Documento confidencial — uso interno*
