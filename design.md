# Documento de Design - Sistema de Biblioteca Comunitária

Este documento detalha a arquitetura, o modelo de dados e as funcionalidades do sistema de biblioteca comunitária para condomínios.

## 1. Visão Geral
O sistema permite que moradores visualizem o catálogo de livros disponíveis no condomínio, realizem empréstimos, renovem prazos e gerenciem suas devoluções. Administradores têm controle total sobre usuários, livros, locais e configurações do condomínio.

## 2. Arquitetura Técnica
- **Frontend**: React 18 com TypeScript e Vite.
- **Estilização**: Tailwind CSS.
- **Backend / Banco de Dados**: Firebase (Firestore, Authentication).
- **Gerenciamento de Estado**: React Hooks e Context API (para Autenticação).
- **Animações**: Framer Motion.
- **Ícones**: Lucide React.

## 3. Modelo de Dados (Firestore)

### Entidades Principais
- **users**: Cadastro de moradores e administradores.
  - Campos: `name`, `email`, `role`, `active`, `apartmentId`, `residencyNote`, `createdAt`, `updatedAt`.
- **books**: Catálogo de livros físicos.
  - Campos: `title`, `author`, `isbn`, `barcode`, `category`, `status` (AVAILABLE, LOANED, INACTIVE), `availableLocationType`, `notes`.
- **book_loans**: Registro de transações de empréstimo.
  - Campos: `bookId`, `apartmentId`, `borrowerUserId`, `status` (ACTIVE, RETURNED), `loanedAt`, `dueAt`, `renewalCount`.
- **apartments**: Unidades residenciais.
  - Campos: `number`, `blockId`, `condoId`, `active`.
- **blocks**: Blocos/Torres do condomínio.
  - Campos: `name`, `condoId`, `active`.
- **locations**: Locais fixos de retirada/entrega (ex: Portaria, Sala de Jogos).

## 4. Perfis de Usuário e Permissões

### Residente (`RESIDENT`)
- **Acesso**: Requer aprovação prévia do administrador (`active: true`).
- **Permissões**:
  - Visualizar catálogo de livros.
  - Solicitar empréstimo de livros disponíveis.
  - Visualizar seus próprios empréstimos ativos e histórico.
  - Renovar empréstimos (limitado a 3 renovações).
  - Editar perfil e trocar descrição da residência.

### Administrador (`ADMIN`)
- **Acesso**: Definido manualmente ou por e-mail mestre (`brunoscruz@gmail.com`).
- **Permissões**:
  - Gestão de Usuários: Aprovar/Bloquear novos cadastros.
  - Gestão de Catálogo: Adicionar, editar e remover livros.
  - Gestão de Infraestrutura: Configurar locais, blocos e apartamentos.
  - Monitoramento: Ver todos os empréstimos ativos no sistema.

## 5. Fluxos Principais

### Cadastro e Aprovação
1. O usuário se registra fornecendo nome, e-mail, senha e descrição da residência.
2. O sistema cria o registro no Firebase Auth e um documento em `users` com `active: false`.
3. O usuário vê uma tela de bloqueio informando que aguarda aprovação.
4. O administrador acessa a aba "Usuários", vê o novo registro e altera para `Ativo`.
5. O usuário agora pode acessar o catálogo.

### Processo de Empréstimo
1. Morador escolhe um livro "Disponível" no catálogo.
2. Confirma a solicitação, que cria um registro em `book_loans` e altera o `status` do livro para `LOANED`.
3. O prazo inicial é de 15 dias.

## 6. Melhorias e Ajustes Recentes
- **Segurança de Regras**: Implementação de regras do Firestore que impedem cadastros maliciosos de se tornarem administradores automaticamente.
- **Persistência de Dados**: Correção no fluxo de registro para garantir que o perfil seja gravado no Firestore antes que qualquer logout por segurança ocorra.
- **UX de Bloqueio**: Substituição do logout imediato por uma tela informativa amigável para usuários aguardando aprovação.
- **Performance de Consultas**: Otimização do Admin para carregar listas grandes ordenadas em memória, evitando erros de índice faltando no Firebase.
- **Tratamento de Erros**: Implementação do `handleFirestoreError` para diagnósticos precisos em caso de falha de permissão.

---
*Documento gerado em: 06 de Maio de 2026.*
