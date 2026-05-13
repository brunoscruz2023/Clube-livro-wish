# Detalhamento Técnico das Regras de Segurança (Firestore Rules)

Este documento traduz a lógica técnica do arquivo `firestore.rules` para uma linguagem operacional e estratégica, em total conformidade com o **Documento de Design (googleaidesign.md)** e o **PRD Canônico (PRD07052026.md)**.

## Security Rules, resumo operacional

As regras de segurança do "Clube do Livro" utilizam um modelo de **Identidade Baseada em Atributos (ABAC)**. O acesso é segmentado entre **Administradores** (acesso total) e **Residentes** (acesso restrito ao seu contexto e condicionado à aprovação).

### 1) Funções Auxiliares (Primitivas)
- **isSignedIn()**: Verifica se o usuário está autenticado no Firebase Auth.
- **isAdmin()**: Verifica se o e-mail do usuário é o mestre (`brunoscruz@gmail.com`) ou se o documento dele na coleção `users` possui o campo `role == 'ADMIN'`. Utiliza `exists()` e `get()` para validação robusta.
- **getUserData()**: Atalho para recuperar o documento do usuário logado na coleção `users`.
- **isActive()**: Verifica se o campo `active` do usuário é `true`. Condição obrigatória para a maioria das operações de escrita de Residentes.
- **belongsToApartment(aptoId)**: Crucial para segurança relacional. Verifica se o `apartmentId` no perfil do usuário coincide com o `apartmentId` que ele está tentando registrar em um empréstimo.
- **isValidId(id)**: Proteção contra injeção de IDs maliciosos (verifica tamanho e caracteres permitidos).
- **incoming() / existing()**: Atalhos para `request.resource.data` (dados novos) e `resource.data` (dados atuais), respectivamente.

---

## Matriz de permissões por role e entidade

### Collection: `users`
- **Read**: O usuário pode ler apenas seu próprio documento; Administradores podem ler todos.
- **Create**: Autocadastro permitido, mas forçando `active: false` e `role: 'RESIDENT'`.
- **Update**: 
  - O próprio usuário pode mudar: `name`, `apartmentId`, `updatedAt`, `residencyNote`.
  - O Administrador pode mudar qualquer campo, especialmente `active` e `role`.
- **Delete**: Apenas Administrador.
- **Bloqueios**: Residentes são proibidos de alterar os campos `role` e `active` (bloqueio de autoprovação).

### Collection: `books`
- **Read**: Todos os usuários autenticados.
- **Write (Create/Delete)**: Restrito ao Administrador.
- **Update**: 
  - Residentes podem atualizar exclusivamente os campos `status`, `availableLocationType`, `availableLocationLabel`, `loanedToApartmentId`, `loanedToApartmentLabel` e `updatedAt` durante o fluxo de empréstimo/devolução.
  - O sistema valida as transições de status permitidas: `AVAILABLE`, `LOANED` e `INACTIVE` (este último apenas via Admin).

### Collection: `book_loans`
- **Read**: Todos os usuários autenticados.
- **Create**: 
  - Exige usuário ativo (`isActive()`) e morador da unidade (`belongsToApartment`).
  - O livro deve estar validado como `AVAILABLE` via `get()`.
  - Campos obrigatórios: `status: 'ACTIVE'`, `renewalCount: 0`, e validade inicial de **14 dias** (calculada como `request.time`).
- **Update**:
  - **Ação Renovar**: Apenas o titular do empréstimo. Permite alterar apenas `renewalCount` (estritamente incremento de +1), `dueAt`, `lastRenewedAt` e `updatedAt`. Limite absoluto de **3 renovações**.
  - **Ação Devolver**: Altera status para `RETURNED` e exige a definição da localização física para onde o livro retornará.
- **Delete**: Apenas Administrador.

### Infraestrutura (`apartments`, `blocks`, `locations`)
- **Read**: Todos os usuários autenticados.
- **Write**: Exclusivo para Administradores.

---

## Lista de validações críticas

1. **Garantia de Disponibilidade**: Um empréstimo (create) só é autorizado se a regra `get()` confirmar o status do livro no banco como `AVAILABLE`. Isso evita "Double Booking" (dois usuários pegarem o mesmo exemplar).
2. **Afinação de Campos (affectedKeys)**: Uso rigoroso de `.diff(resource.data).affectedKeys().hasOnly([...])` para impedir a edição de campos imutáveis (como `loanedAt` ou `bookId`).
3. **Integridade de Identidade**: O campo `borrowerUserId` deve coincidir obrigatoriamente com o `auth.uid` do requisitante.
4. **Temporalidade Segura**: Datas de auditoria (`updatedAt`, `loanedAt`) devem utilizar obrigatoriamente `request.time` (Server Timestamp).

---

## Estratégia para o TO-BE (Supabase RLS)

Na migração para o ambiente relacional descrito no **Passo 5 do PRD**, as regras devem ser convertidas preservando a intenção original:

- **Isolamento de Tenant**: Adição de cláusulas `WHERE condo_id = (SELECT condo_id FROM profiles WHERE id = auth.uid())` em todas as policies.
- **Constraints de Check**: Invariantes como `renewal_count BETWEEN 0 AND 3` devem ser implementadas no nível de tabela (DDL).
- **Validação Cruzada**: Uso de subconsultas em RLS ou `BEFORE INSERT` triggers para garantir o status do livro.
- **Proteção de Colunas**: Bloqueio de updates em colunas imutáveis via gatilhos SQL.

---
**Atributos de Isolação**:
- **apartmentId**: Presente em `users` e `book_loans`. Base para a regra `belongsToApartment`.
- **condoId**: Campo mestre de isolamento (Tenant ID) previsto no mapeamento de migração.

---
*Revisado em: 11 de Maio de 2026 (Auditado para v2.3-canonical).*
