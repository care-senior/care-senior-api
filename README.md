# Care Senior API

Backend em **Node.js + NestJS + PostgreSQL** do app [Care Senior](../care_senior_study/README.md) — serve o app mobile (Flutter) e o futuro web app administrativo (React) sobre a mesma base de dados.

> **Status atual:** só os **modelos de domínio** (entidades TypeORM + enums) estão implementados. Ainda não há repositórios, services, controllers, endpoints, schema SQL versionado ou Docker Compose — ver "Próximos passos" no fim deste documento.

## Stack

| Camada          | Tecnologia               |
| --------------- | ------------------------- |
| Framework       | NestJS                    |
| Linguagem       | TypeScript (ESM)          |
| ORM             | TypeORM                   |
| Banco de dados  | PostgreSQL                |
| Testes          | Vitest                    |
| Lint            | oxlint                    |

## Pré-requisitos

- [Node.js](https://nodejs.org/) 22 ou superior (testado com 24.x)
- Um PostgreSQL acessível — localmente instalado, ou via container Docker (exemplo abaixo)

## Passo a passo para rodar o projeto

### 1. Instalar as dependências

```bash
npm install
```

### 2. Configurar as variáveis de ambiente

Copie o `.env.example` para `.env` e preencha com os dados de conexão do seu PostgreSQL:

```bash
cp .env.example .env
```

Variáveis necessárias (ver `.env.example`):

| Variável      | Descrição                       |
| ------------- | -------------------------------- |
| `DB_HOST`     | Host do PostgreSQL               |
| `DB_PORT`     | Porta do PostgreSQL (padrão 5432) |
| `DB_USERNAME` | Usuário de conexão com o banco   |
| `DB_PASSWORD` | Senha de conexão com o banco     |
| `DB_NAME`     | Nome do banco/catálogo           |

O `.env` nunca deve ser commitado — já está no `.gitignore`.

### 3. Subir um PostgreSQL local (se ainda não tiver um)

Enquanto o Docker Compose oficial do projeto não existe (será entregue pelo agente DevOps), um jeito rápido de ter um banco local pra desenvolver:

```bash
docker run --name care-senior-db -e POSTGRES_USER=care_senior -e POSTGRES_PASSWORD=care_senior_local -e POSTGRES_DB=care_senior -p 5432:5432 -d postgres:16
```

Isso corresponde exatamente aos valores já preenchidos no `.env` deste repositório para desenvolvimento local.

### 4. Rodar a API em modo desenvolvimento

```bash
npm run start:dev
```

A API sobe com hot-reload a cada alteração em `src/`.

> Como só existem entidades TypeORM (sem schema SQL, sem `synchronize`), a conexão com o banco só terá tabelas para consultar depois que os scripts SQL versionados do agente DBA forem aplicados. Até lá, a aplicação sobe normalmente, mas qualquer tentativa de ler/gravar dados falhará por falta de tabelas.

### 5. Build de produção

```bash
npm run build
npm run start:prod
```

### 6. Lint e testes

```bash
npm run lint
npm test
npm run test:e2e
```

## Estrutura do projeto

```
src/
 ├── common/enums/          # Enums de domínio compartilhados (ActivityType, StaffRole, etc.)
 ├── clinics/entities/
 ├── rooms/entities/
 ├── staff/entities/
 ├── guardians/entities/
 ├── residents/entities/
 ├── outing-requests/entities/
 ├── activities/entities/
 ├── routines/entities/
 ├── medications/entities/
 ├── health-records/entities/
 ├── messages/entities/
 ├── feedback/entities/
 ├── notifications/entities/
 ├── app.module.ts          # Registro do TypeORM e config global
 └── main.ts
```

Cada entidade mapeia 1:1 com as tabelas descritas no [README do app mobile](../care_senior_study/README.md), incluindo as duas entidades que só existem para o backend/web app (`Room`, `Routine`).

## Próximos passos

- Repositórios, services e controllers por módulo
- Scripts SQL versionados (schema real do banco, produzido pelo agente DBA)
- Autenticação (`JwtAuthGuard`, `RolesGuard`)
- Docker Compose e Dockerfile
- Criptografia de dados sensíveis (`cpf` em `StaffMember`/`Guardian`)
