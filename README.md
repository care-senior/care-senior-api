# Care Senior API

Backend em **Node.js + NestJS + PostgreSQL** do [Care Senior](../care_senior_study/README.md), um app de acompanhamento de idosos em clínicas/instituições de longa permanência. Esta API serve dois clientes sobre a mesma base de dados: o app mobile (Flutter, colaborador + responsável) e o futuro web app administrativo (React, exclusivo pra colaboradores).

O domínio gira em torno de uma clínica que cuida de idosos (`Resident`), cada um acompanhado por sua equipe (`StaffMember`) e por um ou mais responsáveis/familiares (`Guardian`). Em cima disso existe a rotina do dia a dia — agenda (`Activity`), medicação (`Medication`), registros de saúde (`HealthRecord`) — e os fluxos administrativos que conectam clínica e responsável: vínculo de um idoso a uma clínica, solicitações de saída (`OutingRequest`), mensagens e notificações.

## Stack

| Camada         | Tecnologia              |
| -------------- | ----------------------- |
| Framework      | NestJS                  |
| Linguagem      | TypeScript (ESM)        |
| ORM            | TypeORM                 |
| Banco de dados | PostgreSQL              |
| Testes         | Vitest                  |
| Lint           | oxlint                  |
| Containers     | Docker + Docker Compose |
| CI             | GitHub Actions          |

## Como o código está organizado

Um módulo por área de domínio, cada um com sua(s) entidade(s) em `entities/`:

```
src/
 ├── common/enums/       # Enums compartilhados entre entidades (ActivityType, StaffRole, ...)
 ├── clinics/
 ├── rooms/              # Sem equivalente no app mobile — só backend/web app
 ├── staff/
 ├── guardians/
 ├── residents/
 ├── outing-requests/
 ├── activities/
 ├── routines/           # Sem equivalente no app mobile — só backend/web app
 ├── medications/
 ├── health-records/
 ├── messages/
 ├── feedback/
 ├── notifications/
 ├── app.module.ts       # Composition root: registra TypeORM e a config global
 └── main.ts
```

Cada entidade mapeia 1:1 com as tabelas descritas no [README do app mobile](../care_senior_study/README.md), que é a referência de produto por trás de todo esse modelo. A partir daqui, o padrão NestJS de sempre se aplica: cada módulo cresce com `*.service.ts`, `*.controller.ts` e DTOs conforme os casos de uso são implementados, sempre lendo/gravando através da entidade correspondente. Não há migrations geradas pelo ORM — o schema real do Postgres vem de scripts SQL versionados por fora do TypeORM (por isso `synchronize` fica sempre `false` em `app.module.ts`).

## Entidades

| Entidade                                    | O que representa                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `Clinic`                                    | A instituição — endereço, contatos, serviços oferecidos                    |
| `Room`                                      | Inventário de quartos por clínica (ocupação, andar, ala)                   |
| `StaffMember`                               | Colaborador da clínica (`StaffRole`: coordenadora, enfermeira ou cuidador) |
| `Guardian`                                  | Responsável/familiar de um ou mais idosos                                  |
| `Resident`                                  | O idoso — dados de saúde, humor, contato de emergência                     |
| `OutingRequest`                             | Pedido do responsável pra levar o idoso pra fora da clínica                |
| `Activity`                                  | Item da agenda (medicação, refeição, atividade física, ...)                |
| `ActivityParticipant`                       | Participação de um idoso numa `Activity`, com status individual            |
| `Routine`                                   | Regra recorrente que gera `Activity` automaticamente                       |
| `Medication`                                | Prescrição estruturada de um medicamento                                   |
| `HealthRecord`                              | Registro pontual de um dado de saúde (pressão, glicose, ...)               |
| `Message`                                   | Recado entre equipe e responsável sobre um idoso                           |
| `UserFeedback`                              | Feedback enviado por um colaborador ou responsável                         |
| `AppNotification` / `NotificationRecipient` | Notificação e o controle de leitura por destinatário                       |

## Decisões de modelagem

Coisas que não ficam óbvias só olhando os campos:

| Onde                                                    | Por quê                                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Clinic.activities` vs. `Clinic.scheduledActivities`    | O primeiro é texto livre dos serviços oferecidos; o segundo aponta pra agenda (`Activity`). Nomes diferentes de propósito.                                                |
| `Room`, `Routine`                                       | Sem equivalente no app mobile — existem só pro backend/web app. O mobile continua vendo `Resident.roomNumber` como texto solto e nunca enxerga uma `Routine`.             |
| `Resident.roomNumber`                                   | É um _getter_ (`room?.number`), não uma coluna — mantém o contrato do mobile sem duplicar o dado de `Resident.room`.                                                      |
| `Resident.clinicId` / `roomId`                          | Nulos antes do primeiro vínculo e depois de uma desvinculação/alta. Histórico e responsáveis continuam existindo mesmo sem clínica.                                       |
| `Guardian` ↔ `Resident`                                 | N:N de verdade (`guardian_resident`) — um responsável pode acompanhar idosos em clínicas diferentes, um idoso pode ter mais de um responsável.                            |
| `Activity` → `Resident`                                 | Não existe FK direto — a relação passa por `ActivityParticipant`, que carrega o status individual de cada idoso na atividade.                                             |
| `ActivityParticipant.registeredBy`                      | Auditoria interna (quem da equipe registrou) — nunca deve aparecer num DTO de resposta pra um `guardian`. `rating`/`comment` são visíveis ao responsável, esse campo não. |
| `Activity.medicationId` / `routineId`                   | Só preenchidos quando a atividade é uma dose de medicação ou foi gerada por uma `Routine`, respectivamente.                                                               |
| `Routine.residents` / `rooms`                           | Só preenchidos conforme `Routine.scope`. `active = false` só pausa a geração de novas atividades, não apaga histórico.                                                    |
| `Medication.endDate`                                    | Nulo significa tratamento contínuo, sem previsão de término.                                                                                                              |
| `UserFeedback.authorId`, `NotificationRecipient.userId` | FKs polimórficas (`StaffMember` ou `Guardian`, conforme `authorRole`/`userRole`) — sem relação direta possível no TypeORM, resolvidas na camada de aplicação.             |
| `NotificationRecipient`                                 | Substitui o `audience` genérico do mock original: como leitura é por usuário, cada destinatário tem sua própria linha e seu próprio `readAt`.                             |
| `StaffRole`                                             | Só `COORDINATOR`/`NURSE` (`ROLES_THAT_MANAGE_REQUESTS`) aprovam/recusam solicitações e desvinculam idosos — `CAREGIVER` não.                                              |
| `StaffMember.cpf`, `Guardian.cpf`                       | Dados sensíveis — precisam ser criptografados em repouso antes de persistir.                                                                                              |

## Rodando localmente

Tudo roda em Docker — API e Postgres.

```bash
cp .env.example .env
docker compose up --build
```

`DB_HOST` no `.env` aponta pro nome do serviço (`db`), não `localhost` — de dentro do container da API, `localhost` seria o próprio container.

A imagem da `api` só tem dependências de produção; lint e testes rodam no serviço `api-dev`, que reaproveita o estágio de build com as devDependencies:

```bash
docker compose run --rm api-dev npm run lint
docker compose run --rm api-dev npm test
docker compose run --rm api-dev npm run test:e2e
```

## O que falta implementar

Hoje só existem as entidades TypeORM — nenhum repositório, service, controller ou endpoint real ainda. O contrato de API abaixo é o mapeamento pra atender os dois clientes (mobile + web) sobre a mesma base de dados; "Cliente" na última coluna indica quem consome cada rota hoje, só pra saber o que quebra se o contrato mudar.

Além dos endpoints, falta: autenticação (`JwtAuthGuard`, `RolesGuard`), scripts SQL versionados (schema real do banco), criptografia de `cpf` em `StaffMember`/`Guardian`.

**Convenções gerais** (padrão NestJS):

- Prefixo de versão: `/api/v1/...`.
- Recursos no plural, kebab-case (`/outing-requests`, não `/outingRequest`).
- `GET` de lista aceita filtro via query string (`?clinicId=`, `?residentId=`, `?status=`, `?from=&to=`) — nunca por segmento de rota além do primeiro nível de aninhamento.
- Aninhamento de no máximo 1 nível, só quando o sub-recurso não existe sozinho fora do pai (`/residents/:id/guardians`); o resto é rota plana com filtro.
- `PATCH` pra atualização parcial — nunca `PUT`.
- Ação que não é CRUD puro (aprovar, iniciar, desvincular) vira sub-rota verbo no infinitivo: `POST /resource/:id/acao`.
- Toda rota exige `JwtAuthGuard`, exceto `/auth/*`. Rotas restritas por cargo usam `@Roles(StaffRole.COORDINATOR, StaffRole.NURSE)` com um `RolesGuard` (ver `ROLES_THAT_MANAGE_REQUESTS`).
- Entrada/saída tipadas por DTO (`CreateXDto`, `UpdateXDto`, `XResponseDto`) com `class-validator`/`class-transformer`. O `XResponseDto` de `ActivityParticipant` **não inclui `registeredBy`** quando quem pediu é `guardian` — ver "Decisões de modelagem" acima.
- Paginação padrão em toda lista (`?page=&limit=`).

### Auth

| Método | Endpoint                       | Descrição                                                                        | Cliente | Observação                                     |
| ------ | ------------------------------- | ---------------------------------------------------------------------------------- | ------- | ------------------------------------------------- |
| POST   | `/auth/staff/login`            | Login de colaborador                                                             | Ambos   |                                                 |
| POST   | `/auth/guardian/login`         | Login de responsável                                                             | Mobile  |                                                 |
| POST   | `/auth/guardian/register`      | Autocadastro do responsável + idoso (2 passos consolidados)                      | Mobile  |                                                 |
| POST   | `/auth/staff/accept-invite`    | Define a senha do colaborador recém-cadastrado (body: `token`, `password`)       | Web     | completa o `POST /staff` — ver nota abaixo     |
| POST   | `/auth/guardian/accept-invite` | Define a senha do responsável cadastrado via walk-in (body: `token`, `password`) | Ambos   | completa o `POST /guardians` — ver nota abaixo |
| POST   | `/auth/logout`                 | Invalida a sessão/token atual                                                    | Ambos   |                                                 |

> **De onde vem a senha de quem não se autocadastrou:** `POST /staff` e `POST /guardians` (cadastro pela equipe) criam o registro **sem senha** — o backend deve gerar um token de convite e disparar e-mail/SMS pra quem foi cadastrado definir a própria senha em `/auth/*/accept-invite`. Até lá, a conta existe mas não consegue logar.

### Clinics

| Método | Endpoint       | Descrição                             | Cliente | Observação              |
| ------ | --------------- | ---------------------------------------- | ------- | -------------------------- |
| GET    | `/clinics`     | Lista clínicas (busca do responsável) | Mobile  | responsável pré-vínculo |
| GET    | `/clinics/:id` | Detalhe institucional                 | Ambos   |                         |
| PATCH  | `/clinics/:id` | Editar dados institucionais           | Web     | tela "Clínica"          |

### Staff

| Método | Endpoint     | Descrição                                 | Cliente | Observação                                     |
| ------ | ------------- | -------------------------------------------- | ------- | ---------------------------------------------------- |
| GET    | `/staff`     | Lista colaboradores (`?clinicId=`)        | Web     | tela "Colaboradores"                           |
| POST   | `/staff`     | Cadastrar colaborador                     | Web     |                                                 |
| GET    | `/staff/me`  | Perfil do colaborador logado              | Ambos   |                                                 |
| GET    | `/staff/:id` | Detalhe                                   | Web     |                                                 |
| PATCH  | `/staff/me`  | Editar o próprio perfil (nome, cpf, foto) | Mobile  |                                                 |
| PATCH  | `/staff/:id` | Editar colaborador (inclui `role`)        | Web     |                                                 |
| DELETE | `/staff/:id` | Desativar colaborador                     | Web     | soft delete — nunca apagar linha com histórico |

### Guardians

| Método | Endpoint                           | Descrição                                    | Cliente | Observação                              |
| ------ | ------------------------------------ | ----------------------------------------------- | ------- | ------------------------------------------- |
| POST   | `/guardians`                       | Cadastro walk-in (responsável + idoso)       | Ambos   |                                          |
| GET    | `/guardians/:id`                   | Detalhe                                      | Ambos   |                                          |
| PATCH  | `/guardians/me`                    | Editar o próprio perfil                      | Mobile  |                                          |
| PATCH  | `/guardians/:id`                   | Editar responsável (uso administrativo)      | Web     |                                          |
| POST   | `/guardians/:id/contact-clinic`    | Marcar clínica como contatada (`?clinicId=`) | Mobile  | busca de clínicas pré-vínculo           |
| GET    | `/guardians/pending-link-requests` | Fila de vínculo pendente (`?clinicId=`)      | Ambos   | `PendingLinkRequest` — não é persistida |

### Residents

| Método | Endpoint                               | Descrição                                                           | Cliente | Observação                                       |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------ | ------- | ------------------------------------------------------ |
| GET    | `/residents`                           | Lista (`?clinicId=`, `?guardianId=`)                                | Ambos   |                                                   |
| GET    | `/residents/:id`                       | Detalhe                                                             | Ambos   |                                                   |
| PATCH  | `/residents/:id`                       | Editar perfil (saúde, humor, peculiaridades, contato de emergência) | Ambos   | pré-vínculo (mobile) ou pós-vínculo (mobile/web) |
| POST   | `/residents/:id/link`                  | Aceitar vínculo — preenche `clinicId`/`roomId`                      | Ambos   | fila de Solicitações de vínculo, `@Roles`        |
| POST   | `/residents/:id/discharge`             | Desvincular/dar alta                                                | Ambos   | `@Roles(COORDINATOR, NURSE)`                     |
| POST   | `/residents/:id/change-room`           | Trocar de quarto (`roomId` no body)                                 | Web     | tela "Quartos" / detalhe do idoso                |
| GET    | `/residents/:id/guardians`             | Responsáveis do idoso                                               | Ambos   |                                                   |
| POST   | `/residents/:id/guardians`             | Adicionar mais um responsável                                       | Ambos   | múltiplos responsáveis                           |
| DELETE | `/residents/:id/guardians/:guardianId` | Remover um responsável específico                                   | —       | **planejado** — item em aberto, sem tela ainda   |

### Rooms

| Método | Endpoint     | Descrição                                         | Cliente | Observação     |
| ------ | ------------- | ----------------------------------------------------- | ------- | --------------- |
| GET    | `/rooms`     | Lista (`?clinicId=`, `?status=vacant\|occupied`)  | Web     | tela "Quartos" |
| POST   | `/rooms`     | Cadastrar quarto (número, andar, ala, capacidade) | Web     |                 |
| GET    | `/rooms/:id` | Detalhe                                           | Web     |                 |
| PATCH  | `/rooms/:id` | Editar quarto                                     | Web     |                 |

### Activities

| Método | Endpoint                                            | Descrição                                                     | Cliente | Observação          |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------ | ------- | ---------------------- |
| GET    | `/activities`                                       | Lista (`?clinicId=`, `?residentId=`, `?from=&to=`)            | Ambos   |                     |
| POST   | `/activities`                                       | Agendar atividade (um ou mais idosos)                         | Ambos   |                     |
| GET    | `/activities/:id`                                   | Detalhe + participantes                                       | Ambos   |                     |
| PATCH  | `/activities/:id`                                   | Editar atividade ainda não iniciada                           | Ambos   |                     |
| POST   | `/activities/:id/start-all`                         | Inicia todos os participantes ainda não iniciados             | Mobile  |                     |
| POST   | `/activities/:id/participants/:residentId/complete` | Concluir participante (body: `rating`, `comment`)             | Mobile  |                     |
| POST   | `/activities/:id/participants/:residentId/skip`     | Pular participante (body: `reason`)                           | Mobile  |                     |
| POST   | `/activities/:id/complete-batch`                    | Concluir em lote (body: `residentIds[]`, `rating`, `comment`) | Mobile  | "Selecionar vários" |
| POST   | `/activities/:id/skip-batch`                        | Pular em lote (body: `residentIds[]`, `reason`)               | Mobile  |                     |

### Routines

| Método | Endpoint               | Descrição                                        | Cliente | Observação              |
| ------ | ------------------------ | ----------------------------------------------------- | ------- | -------------------------- |
| GET    | `/routines`            | Lista (`?clinicId=`)                             | Web     | tela "Agenda & Rotinas" |
| POST   | `/routines`            | Criar rotina recorrente                          | Web     |                         |
| GET    | `/routines/:id`        | Detalhe                                          | Web     |                         |
| PATCH  | `/routines/:id`        | Editar (dias, horário, escopo, instruções)       | Web     |                         |
| PATCH  | `/routines/:id/toggle` | Ativar/pausar                                    | Web     |                         |
| DELETE | `/routines/:id`        | Remover rotina (não apaga `Activity` já geradas) | Web     |                         |

### Medications

| Método | Endpoint                      | Descrição                            | Cliente | Observação                                  |
| ------ | ------------------------------- | ---------------------------------------- | ------- | ---------------------------------------------- |
| GET    | `/medications`                | Lista (`?residentId=`, `?clinicId=`) | Ambos   |                                              |
| POST   | `/medications`                | Cadastrar prescrição                 | Ambos   |                                              |
| PATCH  | `/medications/:id`            | Editar prescrição                    | Ambos   |                                              |
| PATCH  | `/medications/:id/deactivate` | Encerrar tratamento                  | Ambos   | preferir isso a `DELETE` — mantém histórico |

### Health records

| Método | Endpoint          | Descrição                            | Cliente | Observação |
| ------ | ------------------- | ---------------------------------------- | ------- | ------------ |
| GET    | `/health-records` | Lista (`?residentId=`, `?clinicId=`) | Ambos   |            |
| POST   | `/health-records` | Registrar dado de saúde              | Mobile  |            |

### Outing requests

| Método | Endpoint                       | Descrição                                        | Cliente | Observação                     |
| ------ | -------------------------------- | ------------------------------------------------------ | ------- | ---------------------------------- |
| GET    | `/outing-requests`             | Lista (`?residentId=`, `?clinicId=`, `?status=`) | Ambos   |                                 |
| POST   | `/outing-requests`             | Criar solicitação                                | Mobile  |                                 |
| GET    | `/outing-requests/:id`         | Detalhe                                          | Ambos   |                                 |
| POST   | `/outing-requests/:id/approve` | Aprovar                                          | Ambos   | `@Roles(COORDINATOR, NURSE)`   |
| POST   | `/outing-requests/:id/reject`  | Recusar (body: `reason`)                         | Ambos   | `@Roles(COORDINATOR, NURSE)`   |
| DELETE | `/outing-requests/:id`         | Cancelar solicitação ainda pendente              | —       | **planejado** — item em aberto |

### Messages

| Método | Endpoint    | Descrição              | Cliente | Observação |
| ------ | ------------ | -------------------------- | ------- | ------------ |
| GET    | `/messages` | Lista (`?residentId=`) | Mobile  |            |
| POST   | `/messages` | Enviar recado          | Mobile  |            |

### Feedback

| Método | Endpoint    | Descrição                | Cliente | Observação        |
| ------ | ------------ | ---------------------------- | ------- | -------------------- |
| GET    | `/feedback` | Lista (`?clinicId=`)     | Web     | tela "Relatórios" |
| POST   | `/feedback` | Enviar feedback           | Mobile  |                    |

### Notifications

| Método | Endpoint                  | Descrição               | Cliente | Observação |
| ------ | --------------------------- | ---------------------------- | ------- | ------------ |
| GET    | `/notifications`          | Lista do usuário logado | Mobile  |            |
| PATCH  | `/notifications/:id/read` | Marcar como lida        | Mobile  |            |
| PATCH  | `/notifications/read-all` | Marcar todas como lidas | Mobile  |            |

### Reports (exclusivo web)

Agregações só de leitura sobre entidades que já existem — nenhuma tabela de "relatório" precisa ser persistida.

| Método | Endpoint                        | Descrição                                            | Cliente | Observação |
| ------ | ---------------------------------- | ----------------------------------------------------------- | ------- | ------------ |
| GET    | `/reports/overview`             | KPIs do dashboard (`?clinicId=`)                     | Web     |            |
| GET    | `/reports/activities-by-type`   | Distribuição por `ActivityType` (`?from=&to=`)       | Web     |            |
| GET    | `/reports/medication-adherence` | Série temporal de adesão (`?from=&to=`)              | Web     |            |
| GET    | `/reports/activity-completion`  | % concluída/pulada/atrasada (`?from=&to=`)           | Web     |            |
| GET    | `/reports/occupancy`            | Ocupação de quartos ao longo do tempo (`?from=&to=`) | Web     |            |
| GET    | `/reports/feedback-summary`     | Média e histograma de notas (`?clinicId=`)           | Web     |            |
