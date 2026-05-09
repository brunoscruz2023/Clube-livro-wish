# Detalhamento Técnico das Regras de Segurança (Firestore Rules)

Este documento traduz a lógica técnica do arquivo `firestore.rules` para uma linguagem operacional e estratégica.

## Security Rules, resumo operacional

As regras de segurança do "Clube do Livro" utilizam um modelo de **Identidade Baseada em Atributos (ABAC)**. O acesso é segmentado entre **Administradores** (acesso total) e **Residentes** (acesso restrito ao seu contexto).

### 1) Funções Auxiliares (Primitivas)
- **isSignedIn()**: Verifica se o usuário está autenticado.
- **isAdmin()**: Verifica se o e-mail do usuário é o mestre (`brunoscruz@gmail.com`) ou se o documento dele na coleção `users` possui o campo `role == 'ADMIN'`. Utiliza `exists()` e `get()` para validação robusta.
- **getUserData()**: Atalho para recuperar o documento do usuário logado do banco de dados.
- **belongsToApartment(aptoId)**: Crucial para segurança relacional. Verifica se o `apartmentId` no perfil do usuário no banco coincide com o `apartmentId` que ele está tentando usar em um empréstimo.
- **isValidId(id)**: Proteção contra injeção de IDs maliciosos (verifica tamanho e caracteres permitidos).
- **incoming() / existing()**: Atalhos para os dados que estão chegando e os dados que já estão no banco, respectivamente.

---

## Matriz de permissões por role e entidade

### Collection: `users`
- **Read**: Usuário pode ler seu próprio documento ou o Admin pode ler todos.
- **Create**: Usuário logado pode criar seu próprio documento (autocadastro).
- **Update**: 
  - O próprio usuário pode mudar: `name`, `apartmentId`, `updatedAt`, `residencyNote`.
  - O Administrador pode mudar qualquer campo (ex: `active`, `role`).
- **Delete**: Apenas o Administrador.
- **Bloqueios**: Moradores não podem alterar o campo `role` nem `active` (anti-autoprovação).

### Collection: `books`
- **Read**: Todos os usuários logados.
- **Write (Create/Delete)**: Apenas Administrador.
- **Update**: 
  - Usuários podem atualizar campos de localização e status (`status`, `availableLocationType`, etc.) exclusivamente durante o fluxo de empréstimo/devolução.
  - O sistema valida se o novo status é apenas `AVAILABLE` ou `LOANED`.

### Collection: `book_loans`
- **Read**: Todos os usuários logados (necessário para ver vitrine de quem está com o livro).
- **Create**: 
  - Deve ser morador da unidade (`belongsToApartment`).
  - O livro deve estar `AVAILABLE` (checado via `get()`).
  - Status inicial deve ser `ACTIVE` e `renewalCount` deve ser 0.
- **Update**:
  - **Ação Renovar**: Apenas o dono do empréstimo. Permite alterar apenas `renewalCount` (incremento de +1), `dueAt`, `lastRenewedAt` e `updatedAt`. Limite rígido de 3 renovações.
  - **Ação Devolver**: Altera status para `RETURNED` e grava dados de localização da devolução.
- **Delete**: Apenas Administrador.

### Outras Coleções (`apartments`, `blocks`, `locations`, `condos`)
- **Read**: Todos os usuários logados.
- **Write**: Apenas Administrador.

---

## Lista de validações críticas

1. **Estado do Livro**: Um empréstimo só é gravado se a regra de segurança confirmar no banco que o status do livro é `AVAILABLE`. Isso impede que dois usuários peguem o mesmo livro simultaneamente em condições de corrida.
2. **Afinação de Campos (affectedKeys)**: As regras usam `.diff(resource.data).affectedKeys().hasOnly([...])` para garantir que um usuário não altere campos proibidos (como mudar a data original do empréstimo para burlar multas/prazos).
3. **Integridade de Identidade**: Força que o `borrowerUserId` no documento de empréstimo seja exatamente o UID do usuário que está autenticado.
4. **Validação de ID**: Impede que scripts injetem strings gigantescas como chaves de documento, o que poderia causar ataques de negação de serviço ou aumento de custos de infraestrutura.

---

## Pontos que precisam virar RLS no Supabase

Caso o projeto seja migrado para Supabase (PostgreSQL), os seguintes itens precisam ser convertidos em políticas RLS:

- **Proprietário do Dado**: `auth.uid() = user_id`.
- **RBAC (Role-Based Access Control)**: Criar uma função `is_admin()` que consulta uma tabela de perfis.
- **Validação Cruzada**: Usar subqueries em `CHECK` constraints ou políticas RLS para verificar se o livro está disponível antes de permitir o insert na tabela de empréstimos.
- **Colunas Imutáveis**: Utilizar triggers ou as novas funcionalidades do Supabase para impedir o update em colunas como `created_at` ou `book_id` após a criação do registro.

---
**Identificação de Atributos Críticos**:
- **apartmentId**: Presente em `users` e `book_loans`. Usado para isolamento de responsabilidade da unidade.
- **blockId**: Presente em `apartments` e `books`. Usado para hierarquia de localização.
- **condoId**: Reservado para suporte multi-condomínio futuro (atualmente lido em `apartments` e `blocks`).

---
*Gerado em: 08 de Maio de 2026.*
