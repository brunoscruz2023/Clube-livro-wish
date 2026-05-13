# SDD Framework: Spec-Driven Development (CORE SPEC)
Version: 1.2
Author: AI Studio Build + @brunoscruz

## 1. Visão Geral
O Spec-Driven Development (SDD) é um framework de desenvolvimento sistêmico projetado para maximizar a assertividade da IA, garantindo que toda execução técnica seja precedida por um alinhamento rigoroso com as especificações de domínio e planejamento operacional.

## 2. Pilares de Governança (Bootloader)
Este framework opera sob a **REGRA DE OURO**:
> **NENHUMA EXECUÇÃO DEVE SER REALIZADA ANTES DE UM PLANEJAMENTO E DE UM ACEITE OU LIBERAÇÃO DO USUÁRIO, EM HIPÓTESE ALGUMA.**

### Fontes de Verdade (Single Source of Truth)
- **Design Spec**: Arquivo `design.md` (ou `googleaidesign.md`). Contém o domínio, enums, regras de negócio e contratos.
- **Operational Spec**: Arquivo `PRD07052026.md`. Contém o log de decisões, backlog de tasks e estado migratório.
- **Agent Rules**: Arquivo `AGENTS.md`. Contém as restrições comportamentais da IA.

## 3. O Ciclo SDD (As 4 Fases)

### Fase 1: Levantamento / Briefing
- **Objetivo**: Capturar o desejo do usuário e validar contra a Spec de Design.
- **Ação da IA**: Ler as specs existentes, identificar conflitos ou lacunas e documentar a necessidade em linguagem natural.

### Fase 2: Análise / Definição de Stacks
- **Objetivo**: Traduzir o briefing em decisões técnicas.
- **Ação da IA**: Definir tecnologias, modelos de dados (Firestore/Postgres), APIs e arquitetura de componentes. Registrar no `Decision Log` do PRD.

### Fase 3: Estruturação / Tasks
- **Objetivo**: Decompor o projeto em unidades atômicas de trabalho.
- **Ação da IA**: Criar IDs de tarefas (ex: T-001) com status (TODO, DOING, DONE) e prioridade. Sinalizar tasks para sub-agentes se necessário.

### Fase 4: Controle de Execução (SDD Loop)
- **Execução**: Apresentar Plano -> Receber Aprovação -> Executar -> Validar (Build/Lint) -> **Apresentar Resultado**.
- **Aceite Final**: Obter o "OK" explícito do usuário de que o objetivo foi alcançado.
- **Sincronização de Docs**: Após o aceite, verificar e propor atualizações em: `PRD07052026.md`, `DETALHAMENTO_RULES_08052026.md`, `FIREBASE_REPORT_08052026.md`, `FIRESTORE.POSTGRES_MAPPING.md` e `design.md`.
- **Monitoramento**: Atualização final de status no PRD.

## 4. Orquestração Híbrida (Build + Jules)
Este framework prevê a colaboração entre instâncias de IA com especializações distintas, utilizando o **GitHub como barramento de sincronização**.

### Workflow de Sub-execução:
1. **Delegamento**: O Build (Agente de Prototipagem) identifica uma tarefa que se beneficia das ferramentas de IDE (Jules). A task é marcada no PRD como `[JULE-TASK]`.
2. **Sincronização**: O usuário realiza o "Export/Push" do projeto para o GitHub.
3. **Execução Especializada**: O Jules (Agente de IDE) assume a tarefa no ambiente local/IDE, realizando refatorações complexas ou correções de baixo nível.
4. **Integração**: O Jules realiza o "Commit/Push" das alterações.
5. **Reconciliação**: O Build detecta a atualização do repositório, lê os arquivos modificados e valida se a spec continua íntegra, fechando o loop da task no PRD.

## 5. Instruções para Re-inicialização de Sessão
Sempre que uma nova sessão for iniciada (ou após uma atualização externa via Jules), a IA deve:
1. Ler `framework.md` para entender a metodologia.
2. Ler `AGENTS.md` para absorver as regras críticas de aprovação.
3. Ler `PRD*.md` e `design.md` para recuperar o estado atual do projeto.
4. **Resumir o estado atual e aguardar instruções**, sem tomar ações de escrita.

## 6. Formato de Implementação Recomendado
- **Atômico**: Um commit/edit por funcionalidade lógica.
- **Auditável**: Toda mudança deve estar vinculada a uma Task ou Decisão documentada.
- **Seguro**: Priorizar integridade de dados e regras de segurança (Firebase Rules/SQL RLS) em todos os estágios.

---
*Documento de referência para o desenvolvimento do projeto Clube do Livro e futuros sistemas.*
