# Care Senior API

Backend em **Node.js + NestJS + PostgreSQL** do app [Care Senior](../care_senior_study/README.md) — serve o app mobile (Flutter) e o futuro web app administrativo (React) sobre a mesma base de dados.

> **Status atual:** só os **modelos de domínio** (entidades TypeORM + enums) estão implementados. Ainda não há repositórios, services, controllers, endpoints ou schema SQL versionado — ver "Próximos passos" no fim deste documento.

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

- [Docker](https://www.docker.com/) + Docker Compose

## Setup do projeto

### 1. Configurar as variáveis de ambiente

```bash
cp .env.example .env
```

Variáveis (ver `.env.example`):

| Variável      | Descrição                          |
| ------------- | ----------------------------------- |
| `DB_HOST`     | Host do PostgreSQL                  |
| `DB_PORT`     | Porta publicada do PostgreSQL no host |
| `DB_USERNAME` | Usuário de conexão com o banco      |
| `DB_PASSWORD` | Senha de conexão com o banco        |
| `DB_NAME`     | Nome do banco/catálogo              |
| `API_PORT`    | Porta publicada da API no host      |

O `.env` nunca deve ser commitado — já está no `.gitignore`. O valor padrão de `DB_HOST` é `db` (o nome do serviço no `docker-compose.yml`), porque a API roda dentro do mesmo compose que o banco — de dentro do container, `localhost` apontaria para o próprio container da API, não para o do banco.

### 2. Subir tudo com Docker Compose

```bash
docker compose up --build
```

Isso sobe dois serviços:

| Serviço | Descrição                          | Porta no host        |
| ------- | ----------------------------------- | --------------------- |
| `db`    | PostgreSQL 16                       | `DB_PORT` (padrão 5432) |
| `api`   | API NestJS (build multi-stage)      | `API_PORT` (padrão 3000) |

> Como só existem entidades TypeORM (sem schema SQL, sem `synchronize`), o banco sobe vazio. Qualquer tentativa de ler/gravar dados só vai funcionar depois que os scripts SQL versionados do agente DBA forem aplicados.

### 3. Lint e testes

A imagem da `api` só tem dependências de produção. Lint e testes rodam no serviço `api-dev`, que reaproveita o estágio de build (com as devDependencies):

```bash
docker compose run --rm api-dev npm run lint
docker compose run --rm api-dev npm test
docker compose run --rm api-dev npm run test:e2e
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

Cada entidade mapeia 1:1 com as tabelas descritas no [README do app mobile](../care_senior_study/README.md).

## Modelo de dados

Decisões de modelagem que não são óbvias só de olhar os campos:

- **Clinic.activities** é texto livre dos serviços oferecidos pela clínica — não confundir com a relação `Clinic.scheduledActivities`, que aponta para a agenda (entidade `Activity`). Nomes diferentes de propósito.
- **Room** e **Routine** não têm equivalente no app mobile — existem só para o backend/web app (mapa de ocupação de quartos, rotinas recorrentes que geram `Activity` automaticamente). O mobile continua enxergando `Resident.roomNumber` como texto solto e nunca vê uma `Routine` diretamente.
- **Resident.roomNumber** é um *getter* (`room?.number`), não uma coluna — existe só pra manter o contrato que o mobile já espera, sem duplicar o dado de `Resident.room`.
- **Resident.clinicId/roomId** são nulos antes do primeiro vínculo e voltam a nulo após uma desvinculação/alta — histórico e responsáveis continuam existindo mesmo sem clínica.
- **Guardian ↔ Resident** é N:N de verdade (tabela de junção `guardian_resident`) — um responsável pode acompanhar idosos em clínicas diferentes, e um idoso pode ter mais de um responsável.
- **Activity** não tem FK direto pra `Resident`: a relação passa por `ActivityParticipant` (junção com status individual de presença/execução por idoso).
- **ActivityParticipant.registeredBy**: nunca deve ir num DTO de resposta consumido por um `guardian` — é auditoria interna (quem da equipe registrou), não dado de cuidado. `rating`/`comment` são visíveis ao responsável, `registeredBy` não.
- **Activity.medicationId** só é preenchido quando `type == 'medication'`; **Activity.routineId** só quando a atividade foi gerada automaticamente por uma `Routine`.
- **Routine.residents/rooms** só são preenchidos conforme `Routine.scope` (`specificResidents` ou `specificRoom`, respectivamente). **Routine.active = false** só pausa a geração de novas atividades — não apaga o histórico.
- **Medication.endDate** nulo significa tratamento contínuo (sem previsão de término).
- **UserFeedback.authorId** e **NotificationRecipient.userId** são FKs polimórficas (`StaffMember` ou `Guardian`, conforme `authorRole`/`userRole`) — sem relação direta possível no TypeORM, resolvida manualmente na camada de aplicação.
- **NotificationRecipient** substitui o campo `audience` genérico do mock original: como `read` é por usuário, cada destinatário tem sua própria linha e seu próprio `readAt`, em vez de um booleano global na notificação.
- **StaffMember.cpf** e **Guardian.cpf** são dados sensíveis — precisam ser criptografados em repouso antes de persistir (ver "Próximos passos").
- **StaffRole**: só `COORDINATOR`/`NURSE` (`ROLES_THAT_MANAGE_REQUESTS`) aprovam/recusam solicitações de vínculo e saída, e desvinculam idosos — `CAREGIVER` não.
- `synchronize` do TypeORM fica sempre `false`: o schema real vem de scripts SQL versionados (agente DBA), nunca de sync automático do ORM.

## Próximos passos

- Repositórios, services e controllers por módulo
- Scripts SQL versionados (schema real do banco, produzido pelo agente DBA)
- Autenticação (`JwtAuthGuard`, `RolesGuard`)
- Criptografia de dados sensíveis (`cpf` em `StaffMember`/`Guardian`)
