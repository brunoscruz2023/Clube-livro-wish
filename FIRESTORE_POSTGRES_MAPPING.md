# Mapeamento de Migração: Firestore para PostgreSQL (Supabase) [DOCUMENTO AUXILIAR / NÃO-CANÔNICO]

**AVISO**: Este é um documento de apoio técnico para a migração de dados. A fonte única de verdade (SSOT) para contratos de domínio e regras de negócio é o **PRD (Documento de Design)**.

Este documento descreve a estratégia de de-normalização e mapeamento de tipos para a transição do modelo NoSQL (Firestore) para o Relacional (PostgreSQL).

## Estratégia de Identidade e Metadados
- **Chave Primária (PK)**: Todas as tabelas usarão `id UUID DEFAULT gen_random_uuid()`.
- **Rastreabilidade**: Adição da coluna `source_firebase_id TEXT` em todas as tabelas para armazenar o ID original do Firestore durante a migração.
- **Multi-tenancy**: Adição da coluna `condo_id UUID` (FK para tabela `condos`) como campo obrigatório em todas as entidades.
- **Timestamps**: Conversão de `timestamp` (Firebase) para `TIMESTAMPTZ` (Postgres).

---

## 1. Tabela: `profiles` (Origem: `users`)
Responsável pelos dados de perfil vinculados ao Auth.

| Campo Firestore | Coluna Postgres | Tipo Postgres | Transformação / Observação |
| :--- | :--- | :--- | :--- |
| `(document_id)` | `firebase_uid` | `TEXT` | ID único do Firebase Auth |
| `name` | `name` | `TEXT` | Alinhado com canônico |
| `email` | `email` | `TEXT` | Sincronizado com Auth |
| `role` | `role` | `TEXT` | Valores: 'ADMIN' ou 'RESIDENT' |
| `active` | `active` | `BOOLEAN` | Alinhado com canônico |
| `apartmentId` | `apartment_id` | `UUID` | Foreign Key para `apartments` |
| `residencyNote` | `residency_note` | `TEXT` | Descrição técnica da unidade |
| `createdAt` | `created_at` | `TIMESTAMPTZ` | Default: `now()` |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ` | Default: `now()` |
| **(NOVO)** | `id` | `UUID` | Primary Key interna |
| **(NOVO)** | `condo_id` | `UUID` | Tenant ID |

---

## 2. Tabela: `books` (Origem: `books`)
Catálogo de livros físicos.

| Campo Firestore | Coluna Postgres | Tipo Postgres | Transformação / Observação |
| :--- | :--- | :--- | :--- |
| `(document_id)` | `source_firebase_id`| `TEXT` | Rastreio de migração |
| `title` | `title` | `TEXT` | Título da obra |
| `author` | `author` | `TEXT` | Autor da obra |
| `isbn` | `isbn` | `TEXT` | Identificador opcional |
| `barcode` | `barcode` | `TEXT` | Identificador opcional |
| `status` | `status` | `TEXT` | ENUM: 'AVAILABLE', 'LOANED', 'INACTIVE' |
| `availableLocationType` | `available_location_type` | `TEXT` | Categoria do local |
| `availableLocationLabel`| `available_location_label_legacy` | `TEXT` | Ex: "Hall Bloco A" ou "Apto 101 - Bloco A" |
| `loanedToApartmentId` | `loaned_to_apartment_id` | `UUID` | FK para apartments |
| `loanedToApartmentLabel`| `loaned_to_apartment_label` | `TEXT` | Nome amigável do destino |
| `descricao` | `sinopse` | `TEXT` | Sinopse/Descrição (Metadata) |
| `createdByUserId` | `created_by_user_id` | `TEXT` | Audit: Creator ID |
| `createdByUserEmail` | `created_by_user_email` | `TEXT` | Audit: Creator Email |
| `updatedByUserId` | `updated_by_user_id` | `TEXT` | Audit: Last Updater ID |
| `updatedByUserEmail` | `updated_by_user_email` | `TEXT` | Audit: Last Updater Email |
| `createdAt` | `created_at` | `TIMESTAMPTZ` | |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ` | |
| **(NOVO)** | `condo_id` | `UUID` | FK para `condos` |

---

## 3. Tabela: `book_loans` (Origem: `book_loans`)
Registro de movimentação de livros.

| Campo Firestore | Coluna Postgres | Tipo Postgres | Transformação / Observação |
| :--- | :--- | :--- | :--- |
| `bookId` | `book_id` | `UUID` | FK para `books` |
| `apartmentId` | `apartment_id` | `UUID` | FK para `apartments` |
| `borrowerUserId` | `borrower_user_id` | `UUID` | FK para `profiles` |
| `loanedAt` | `loaned_at` | `TIMESTAMPTZ` | Data de início |
| `dueAt` | `due_at` | `TIMESTAMPTZ` | Data de devolução |
| `renewalCount` | `renewal_count` | `INTEGER` | Contador (0 a 3) |
| `status` | `status` | `TEXT` | ENUM: 'ACTIVE', 'RETURNED' |
| `createdAt` | `created_at` | `TIMESTAMPTZ` | |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ` | |
| **(NOVO)** | `condo_id` | `UUID` | FK para `condos` |

---

## 4. Tabela: `apartments` (Origem: `apartments`)
Unidades do condomínio.

| Campo Firestore | Coluna Postgres | Tipo Postgres | Transformação / Observação |
| :--- | :--- | :--- | :--- |
| `number` | `number` | `TEXT` | Ex: "101", "A-12" |
| `blockId` | `block_id` | `UUID` | FK para `blocks` |
| `active` | `active` | `BOOLEAN` | |
| **(NOVO)** | `condo_id` | `UUID` | FK para `condos` |

---

## 5. Tabela: `blocks` (Origem: `blocks`)
Estruturas verticais ou horizontais.

| Campo Firestore | Coluna Postgres | Tipo Postgres | Transformação / Observação |
| :--- | :--- | :--- | :--- |
| `name` | `name` | `TEXT` | Ex: "Torre Norte", "Bloco A" |
| `active` | `active` | `BOOLEAN` | |
| **(NOVO)** | `condo_id` | `UUID` | FK para `condos` |

---

## 6. Tabela: `locations` (Origem: `locations`)
Pontos fixos de logística.

| Campo Firestore | Coluna Postgres | Tipo Postgres | Transformação / Observação |
| :--- | :--- | :--- | :--- |
| `name` | `name` | `TEXT` | Ex: "Portaria Central" |
| `active` | `active` | `BOOLEAN` | |
| **(NOVO)** | `condo_id` | `UUID` | FK para `condos` |

---

## 7. Tabela: `api_logs` (Origem: `api_logs`)
Registro de consultas a APIs externas de livros.

| Campo Firestore | Coluna Postgres | Tipo Postgres | Transformação / Observação |
| :--- | :--- | :--- | :--- |
| `isbn` | `isbn` | `TEXT` | ISBN consultado |
| `rawResponse` | `raw_response` | `JSONB` | Dados brutos da API |
| `userId` | `profile_id` | `UUID` | FK para `profiles` |
| `userEmail` | `user_email` | `TEXT` | Email (redundante para auditoria) |
| `createdAt` | `created_at` | `TIMESTAMPTZ` | |
| **(NOVO)** | `condo_id` | `UUID` | FK para `condos` |

## 8. Tabela: `condos` (Entidade de Raiz)
Tabela não existente no NoSQL como coleção explícita, mas necessária para o modelo TO-BE.

| Coluna Postgres | Tipo Postgres | Observação |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key |
| `name` | `TEXT` | Nome do Condomínio |
| `slug` | `TEXT` | Identificador para URL (opcional) |
| `created_at` | `TIMESTAMPTZ` | Registro de fundação no sistema |

---
**Observação Técnica**: Os IDs de documento do Firestore (ex: `vX2j...`) que não forem UIDs de autenticação serão movidos para a coluna `source_firebase_id` apenas para fins de auditoria de migração, não sendo utilizados como chaves primárias no Postgres.
