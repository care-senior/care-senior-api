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
