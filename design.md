# Documento de Design, Sistema de Biblioteca Comunitária (FONTE DE VERDADE DO DOMÍNIO)
Doc-ID: DESIGN-BOOKCLUB
Versão: v1.22
Atualizado em: 2026-05-17

## Changelog
- v1.23: implementada sincronização reativa de coverUrl via state, corrigido bug de referência no Smart Merge e refinada interface de captura com guia 2:3.
- v1.22: refinada interface de captura de capa com guias visuais, correção do fluxo de repetição (retake) e persistência reativa no formulário.
- v1.21: reforçada a validação de duplicidade com "double-check" no clique do botão "SIM" para garantir bloqueio de ISBN próprio.
- v1.20: reforçada a integridade de dados com validação de duplicidade de ISBN no servidor (`handleSubmit`) e bloqueio preventivo na busca.
- v1.19: refinado controle de duplicidade de ISBN: o botão "SIM" agora realiza o cadastro automático se validado; o botão "NÃO" limpa o formulário integralmente.
- v1.18: implementado controle de duplicidade de ISBN no cadastro com interceptação de busca local e restrição de uma cópia por usuário.
- v1.17: restaurada a gravação de logs de API (`api_logs`) para auditoria e enriquecimento de metadados.
- v1.16: encerrado processo de backfill automático; campo `descricao` agora é populado obrigatoriamente durante o cadastro inicial via metadados de API.
- v1.15: implementada captura automática de descrição (campo `descricao`) de livros via metadados de API.
- v1.14: refinada hierarquia de locais com prefixo "Hall " automático e lógica de reset de formulário no Admin.
- v1.13: implementada hierarquia dinâmica de locais no cadastro de livros (Blocos/Apartamentos) e remoção definitiva de dados de exemplo.
- v1.12: suporte a pesquisa manual de ISBN com botão dinâmico e modal de feedback para livros não localizados nas APIs integradas.
- v1.11: padronização visual das capas dos livros (aspect-ratio 3:4 e alinhamento superior) no BookCard e no seletor de candidatos, garantindo uma grade uniforme e profissional.
- v1.10: implementada interface de seleção para múltiplos candidatos de metadados de livros (ISBN) com lógica de "Smart Merge", permitindo ao administrador escolher o melhor resultado e complementar campos vazios com dados de outras fontes.
- v1.9: refatorada a integração com APIs de livros para utilizar um proxy no backend (Express), ocultando a API Key do navegador e centralizando as requisições.
- v1.8: adicionado suporte a escaneamento de código de barras (ISBN) e integração com APIs externas (Google Books/OpenLibrary) para cadastro automatizado de livros.
- v1.7: corrigiu a exibição da identificação da unidade (Número do Apto e Bloco) no cabeçalho da tela de Meus Empréstimos, substituindo o ID técnico por labels amigáveis.
- v1.6: introduziu componente `BookCard.tsx` para consistência visual entre Catálogo e Histórico de Empréstimos, alinhando a interface mobile para exibição em 2 colunas em ambas as telas.
- v1.5: adicionou campos `loanedToApartmentId` e `loanedToApartmentLabel` à entidade `books` e corrigiu query de histórico em `MyLoans.tsx`.
- v1.4: normalizou Markdown (sem escapes) e consolidou prazo inicial de empréstimo em 14 dias como único valor válido.
- v1.2: alinhou prazo inicial de empréstimo para 14 dias.
- v1.1: fechou contrato de localização física do livro quando AVAILABLE.

---

## 1. Visão Geral
O sistema permite que moradores visualizem o catálogo de livros disponíveis no condomínio, realizem empréstimos, renovem prazos e gerenciem suas devoluções. Administradores têm controle total sobre usuários, livros, locais e configurações do condomínio.

---

## 2. Arquitetura Técnica (AS-IS)
- Frontend: React 18 com TypeScript e Vite
- Estilização: Tailwind CSS
- Backend e Banco de Dados: Firebase (Firestore, Authentication)
- Gerenciamento de Estado: React Hooks e Context API
- Animações: Framer Motion
- Ícones: Lucide React

---

## 3. Modelo de Dados (Firestore) (AS-IS)
Entidades principais:
- `users`: `name`, `email`, `role`, `active`, `apartmentId`, `residencyNote`, `createdAt`, `updatedAt`
- `books`: `title`, `author`, `isbn`, `barcode`, `status`, `availableLocationType`, `availableLocationLabel`, `loanedToApartmentId`, `loanedToApartmentLabel`, `descricao` (audit/metadata)
- `book_loans`: `bookId`, `apartmentId`, `borrowerUserId`, `status`, `loanedAt`, `dueAt`, `renewalCount`, `returnedAt`, `returnLocationType`, `returnLocationLabel`, `updatedAt`
- `apartments`: `number`, `blockId`, `active`
- `blocks`: `name`, `active`
- `locations`: `name`, `active`
- `api_logs`: `isbn`, `rawResponse` (JSON), `userId`, `userEmail`, `createdAt`

---

## 4. Perfis de Usuário e Permissões

### Residente (RESIDENT)
- Acesso: requer aprovação (`active: true`)
- Pode: catálogo, empréstimo, renovação (até 3), devolução, ver histórico

### Administrador (ADMIN)
- Acesso: definido manualmente ou por e-mail mestre (`brunoscruz@gmail.com`)
- Pode: aprovar usuários, CRUD de catálogo, CRUD de infraestrutura, ver empréstimos

---

## 5. Fluxos Principais

### Cadastro e Aprovação
1. Usuário se registra com nome, e-mail, senha e descrição da residência
2. Sistema cria registro no Firebase Auth e documento em `users` com `active: false`
3. Usuário vê tela de bloqueio aguardando aprovação
4. Admin acessa aba "Usuários" e altera para Ativo
5. Usuário acessa o catálogo

### Processo de Empréstimo
1. Morador escolhe um livro disponível no catálogo
2. Confirma a solicitação, criando `book_loans` e alterando `books.status` para `LOANED`
3. O sistema sincroniza `loanedToApartmentLabel` no livro para exibição imediata no catálogo.
4. O prazo inicial é de **14 dias**

### Cadastro de Livros (ADMIN)
1. Administrador pode cadastrar livros manualmente ou via escaneamento de código de barras ou digitação manual do ISBN.
2. O sistema utiliza a API do **Google Books** e **OpenLibrary** para buscar metadados.
3. **Busca Manual**: O botão alterna dinamicamente para "Pesquisar ISBN" quando há texto no input de Barcode.
4. **Hierarquia de Locais**: O administrador seleciona o tipo de local (Hall ou Apartamento) e o sistema filtra as opções dinamicamente:
    - **HALL**: Lista os Blocos cadastrados com o prefixo "Hall " automático (ex: "Hall Bloco A").
    - **APARTMENT**: Lista todos os Apartamentos (formato "Apto XXX - Bloco Y").
5. **Casos de múltiplos resultados**: Interface de seleção com **Smart Merge**.
6. **Livro não localizado**: Modal de alerta caso as APIs retornem vazio.
7. O recurso de scanner é componenteizado.
8. **Reset de Formulário**: Ao cancelar ou salvar, todos os campos (incluindo ISBN e seletores de local) são limpos para o próximo cadastro.

---

## 6. Melhorias e Ajustes Recentes (AS-IS)
- Scanner de Código de Barras: implementação de POC de scanner (html5-qrcode) e serviço de integração com Google Books API e OpenLibrary para reduzir o esforço de cadastro de novos livros.
- Identificação de Unidade: melhoria na exibição do número do apartamento e bloco no cabeçalho da página de empréstimos do morador, garantindo que o usuário veja "Apto 101 - Bloco A" em vez de um UUID.
- Componentização de UI: introdução do `BookCard.tsx` para garantir que o catálogo e o histórico de leitura sigam o mesmo padrão visual e densidade de informação. Implementada padronização de imagens (aspect-ratio 3/4 e alinhamento `object-top`) para garantir que capas de diferentes fontes não quebrem o alinhamento da grade.
- Consistência Mobile: alinhamento do grid do Histórico de Leitura para 2 colunas em telas pequenas, melhorando a navegabilidade em dispositivos móveis.
- Segurança de Regras: rules do Firestore agora permitem atualização dos campos de localização e posse pelos moradores durante o fluxo de empréstimo.
- Histórico de Leitura: correção na query de `MyLoans.tsx` para filtrar corretamente por status `RETURNED` na aba de histórico.
- Experiência do Catálogo: exibição dinâmica da unidade que está com o livro (Apto + Bloco) no lugar de label genérico.
- Persistência de Dados: correção no fluxo de registro para garantir gravação do perfil no Firestore antes de qualquer logout.
- Performance de Consultas: Admin carrega listas grandes ordenadas em memória para evitar erros de índice.

---

## 7. Contratos do Domínio (TO-BE ready)
Esta seção é o contrato que deve ser respeitado na migração. Se o domínio mudar, atualizar no mesmo commit.

### 7.1 Enums oficiais
- `users.role`: `ADMIN` | `RESIDENT`
- `users.active`: `true` | `false`
- `books.status`: `AVAILABLE` | `LOANED` | `INACTIVE`
- `book_loans.status`: `ACTIVE` | `RETURNED`
- `books.availableLocationType` (TO-BE): `HALL` | `APARTMENT`

### 7.2 Localização física do livro (contrato)
Quando `books.status = AVAILABLE`:
- `availableLocationType` obrigatório
- se `HALL`: `availableLocationId` obrigatório (FK `locations`), `availableApartmentId` nulo
- se `APARTMENT`: `availableApartmentId` obrigatório (FK `apartments`), `availableLocationId` nulo

Quando `books.status = LOANED`:
- os campos "available" devem ser nulos; a posse deriva do `book_loans` ACTIVE

### 7.3 Invariantes de integridade
1. Um `book` não pode ter mais de um `book_loan` com `status = ACTIVE`
2. Se existe `book_loan ACTIVE` para um `bookId`, então `books.status` deve ser `LOANED`
3. Se `books.status = AVAILABLE`, não pode existir `book_loan ACTIVE` para esse `bookId`
4. Se `books.status = AVAILABLE`, a localização física deve estar definida conforme 7.2
5. `RESIDENT` só pode emprestar, renovar e devolver se `users.active = true`
6. `renewalCount` limitado a no máximo 3 por empréstimo
7. Renovação só pode ocorrer quando `book_loans.status = ACTIVE`

### 7.4 Operações críticas (devem ser atômicas no TO-BE)

#### Criar empréstimo
- Pré-condições: livro `AVAILABLE`, usuário `RESIDENT` e `active = true`
- Efeitos: criar `book_loans` (status `ACTIVE`, `loaned_at`, `due_at`, `renewalCount = 0`), atualizar `books.status` para `LOANED`, limpar campos available
- Falha: se livro não estiver `AVAILABLE`, negar por conflito

#### Devolver livro
- Pré-condições: `book_loan ACTIVE` existe, devolução autorizada
- Efeitos: `book_loans.status = RETURNED`, `books.status = AVAILABLE`, definir `availableLocationType` e respectivo ID

#### Renovar empréstimo
- Pré-condições: loan `ACTIVE`, `renewalCount < 3`
- Efeitos: incrementar `renewalCount`, atualizar `dueAt`

### 7.5 Matriz mínima de autorização

RESIDENT (active = true):
- Pode ler catálogo do seu condomínio
- Pode criar empréstimo somente de livro `AVAILABLE`
- Pode renovar somente seus próprios loans `ACTIVE`
- Pode devolver somente seus próprios loans `ACTIVE`
- Não pode alterar `role` ou `active`
- Não pode CRUD de `books`, `blocks`, `apartments`, `locations`

ADMIN:
- Pode aprovar e bloquear usuários
- Pode CRUD de `books`, `blocks`, `apartments`, `locations`
- Pode ver todos os empréstimos
- Não pode existir auto-promoção via client-side

### 7.6 Escopo de tenant (condomínio)
- Leituras e escritas devem ser isoladas por condomínio
- No TO-BE, policies RLS devem impedir acesso cruzado entre condos
