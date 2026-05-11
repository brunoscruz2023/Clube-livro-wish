# Inventário de Dependências Firebase e Regras de Segurança

Este documento contém o levantamento técnico detalhado das dependências Firebase e a análise das regras de segurança do sistema "Clube do Livro".

---

## 7) Firebase Dependencies (AS-IS)

### 7.1 Auth
- **Métodos usados**: 
  - `GoogleAuthProvider` (Login social com popup).
  - `signInWithEmailAndPassword` (Login clássico).
  - `createUserWithEmailAndPassword` (Cadastro de novos moradores).
  - `updateProfile` (Sincronização do nome de exibição).
- **Bootstrap ADMIN**: 
  - Definido estaticamente no código e nas rules pelo e-mail `brunoscruz@gmail.com`.
  - Adicionalmente, qualquer usuário com `role: 'ADMIN'` no Firestore ganha privilégios após o primeiro login.
- **Criação de perfil em users**: 
  - Realizada na função `signUpWithEmail` em `useAuth.tsx`.
  - Cria um documento em `users/{uid}` com campos: `name`, `email`, `role`, `active`, `apartmentId`, `residencyNote`, `createdAt`, `updatedAt`.
- **Bloqueio por active=false**: 
  - Implementado em `App.tsx` via componente `Shell`. Se `user.active === false` e não for admin, renderiza uma tela de "Aguardando Aprovação" bloqueando o acesso às rotas.

### 7.2 Firestore Collections e Schema (inferido do código)

| Collection | Campo | Tipo | Obrigatório | Observações |
| :--- | :--- | :--- | :--- | :--- |
| **users** | name | string | Sim | Nome do morador |
| | email | string | Sim | E-mail único |
| | role | string | Sim | 'ADMIN' ou 'RESIDENT' |
| | active | boolean | Sim | Libera/Bloqueia acesso |
| | apartmentId | string | Não | Link com a unidade |
| | residencyNote | string | Não | Descrição da unidade (ex: "Bloco A - 101") |
| | createdAt/updatedAt | timestamp | Sim | Metadados de tempo |
| **books** | title | string | Sim | Título da obra |
| | author | string | Sim | Autor da obra |
| | isbn/barcode | string | Não | Identificadores únicos |
| | status | string | Sim | 'AVAILABLE', 'LOANED', 'INACTIVE' |
| | availableLocationType | string | Não | Categoria do local onde o livro está |
| | availableLocationLabel | string | Não | Descrição textual do local (ex: "Apto 101") |
| **book_loans** | bookId | string | Sim | ID do livro emprestado |
| | apartmentId | string | Sim | Unidade responsável |
| | borrowerUserId | string | Sim | UID do morador |
| | loanedAt | timestamp | Sim | Data de início |
| | dueAt | timestamp | Sim | Data de devolução prevista (prazo inicial de 14 dias) |
| | renewalCount | number | Sim | Contador de renovações (max 3) |
| | status | string | Sim | 'ACTIVE', 'RETURNED' |
| **apartments** | number | string | Sim | Número da unidade |
| | blockId | string | Sim | Referência ao bloco |
| | active | boolean | Sim | Disponibilidade |
| **blocks** | name | string | Sim | Nome/Letra do bloco |
| | active | boolean | Sim | Disponibilidade |
| **locations** | name | string | Sim | Nome do ponto fixo |
| | active | boolean | Sim | Disponibilidade |

### 7.3 Queries críticas e índices

| Local (Arquivo/Fluxo) | Query (where/orderBy) | Índice Provável | Workaround Atual |
| :--- | :--- | :--- | :--- |
| **Catalog.tsx** | `books` where `active == true` orderBy `title` | `active: ASC, title: ASC` | Nenhum (usa query nativa) |
| **MyLoans.tsx** | `book_loans` where `apartmentId == ID` where `status == 'ACTIVE'` | `apartmentId: ASC, status: ASC` | Nenhum |
| **Admin.tsx** | `apartments` | N/A | Ordenação em memória (`sort` JS) para evitar erro de índice |
| **Admin.tsx** | `users`, `blocks`, `locations` | N/A | Ordenação em memória para garantir performance global |

### 7.4 Security Rules (Estado)

**Resumo operacional das permissões por role e entidade:**

| Entidade | Resident (Read) | Resident (Write) | Admin (Full) | Condição Especial |
| :--- | :--- | :--- | :--- | :--- |
| **users** | Só o próprio | Campos limitados (name, residency) | Sim | Bloqueia auto-promoção para ADMIN |
| **books** | Todos | Apenas campos de localização no return | Sim | Valida transição de status |
| **book_loans** | Todos | Create (próprio) / Update (Renew/Return) | Sim | Só cria se livro estiver AVAILABLE |
| **apartments** | Todos | Não | Sim | Apenas leitura para moradores |
| **blocks** | Todos | Não | Sim | Apenas leitura para moradores |
| **locations** | Todos | Não | Sim | Apenas leitura para moradores |

**Lista de validações críticas**:
1. **isValidLoan**: Verifica a estrutura completa do objeto de empréstimo antes de gravar.
2. **Master Gate**: Usuários só criam `book_loans` se o campo `borrowerUserId` coincidir com seu `auth.uid`.
3. **Limite de Renovações**: Regra impede `renewalCount > 3` diretamente no banco.
4. **Relational Sync**: `create: if get(books/{id}).data.status == 'AVAILABLE'`.
5. **AffectedKeys**: O `update` de usuários é blindado para permitir apenas `name`, `apartmentId`, `updatedAt` e `residencyNote`.

**Pontos que precisam virar RLS no Supabase**:
- Lógica de `belongsToApartment` (checar se o morador pertence à unidade do empréstimo).
- Lógica de `isAdmin` baseada no campo `role` da tabela `profiles` ou similar.
- Restrição de `UPDATE` por colunas específicas (`affectedKeys`).

### 7.5 Functions / Storage / Outros
- **Functions**: NÃO ENCONTRADO NO CÓDIGO. Toda a lógica é client-side com Firestore Transactions.
- **Storage**: NÃO ENCONTRADO NO CÓDIGO. Não há upload de capas ou fotos de perfil no momento.
- **Outros**: Uso intensivo de `serverTimestamp()` para auditoria em todas as coleções.

---
*Gerado em: 08 de Maio de 2026.*
