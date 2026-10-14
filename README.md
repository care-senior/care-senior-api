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
| Jobs agendados | @nestjs/schedule        |
| Testes         | Vitest                  |
| Lint           | oxlint                  |
| Containers     | Docker + Docker Compose |
| CI             | GitHub Actions          |

## Como o código está organizado

Um módulo por área de domínio em `src/modules/`; o que é compartilhado entre módulos fica em `src/common/`, e integração com serviço externo em `src/infra/`:

```
db/
 ├── migrations/            # Schema real do Postgres: NNNN_descricao.sql, aplicados em ordem
 └── seeds/                 # Dados de desenvolvimento (clínica, equipe, responsáveis, atividades)
src/
 ├── main.ts
 ├── app.module.ts          # Composition root: registra TypeORM, a config global e os módulos
 ├── app.controller.ts      # GET / → redireciona pra documentação
 ├── configure-app.ts       # Prefixo, ValidationPipe e cookies — reaproveitado pelos testes e2e
 ├── config/                # Validação das variáveis de ambiente
 ├── common/                # Compartilhado: decorators, guards globais, DTOs de paginação, enums, validators, utils, crypto
 ├── infra/
 │   └── mail/              # Envio de e-mail via SMTP
 └── modules/
     ├── auth/              # Login, sessões (JWT), senha, convite e autocadastro
     ├── clinics/
     ├── staff/
     ├── guardians/
     ├── residents/
     ├── rooms/             # O mobile só lista quartos pra escolher onde colocar o idoso
     ├── activities/
     ├── routines/          # Sem equivalente no app mobile — só backend/web app
     ├── medications/
     ├── health-records/
     ├── outing-requests/
     ├── messages/
     ├── feedback/
     └── notifications/
```

Dentro de cada módulo, só o `x.module.ts` fica na raiz; o resto vai numa pasta por tipo, criada só quando o módulo tem arquivo daquele tipo:

```
src/modules/rooms/
 ├── rooms.module.ts
 ├── controllers/           # rooms.controller.ts
 ├── services/              # rooms.service.ts + rooms.service.spec.ts (teste unitário ao lado)
 ├── dto/                   # create-room.dto.ts, update-room.dto.ts, query-rooms.dto.ts, room-response.dto.ts
 ├── entities/              # room.entity.ts
 ├── enums/                 # enums só deste módulo (room-status.enum.ts)
 ├── guards/                # guards só deste módulo (ex.: auth/guards/auth-throttler.guard.ts)
 └── utils/                 # funções auxiliares que não são service (room-occupancy.ts)
```

Cada entidade mapeia 1:1 com as tabelas descritas no [README do app mobile](../care_senior_study/README.md), que é a referência de produto por trás de todo esse modelo. A partir daqui, o padrão NestJS de sempre se aplica: cada módulo cresce com services, controllers e DTOs (nas pastas acima) conforme os casos de uso são implementados, sempre lendo/gravando através da entidade correspondente. Não há migrations geradas pelo ORM — o schema real do Postgres vem dos scripts SQL em `db/migrations` (por isso `synchronize` fica sempre `false` em `app.module.ts`). Toda mudança de entidade vem acompanhada de um novo script `NNNN_descricao.sql`; scripts já aplicados nunca são editados. Os tipos enum do Postgres têm nome próprio (`staff_role`, `user_role`, ...) e as entidades apontam pra eles com `enumName`.

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
| `ActivityReminder`                          | Lembrete de uma `Activity` já enviado (um por tipo), pra não repetir       |
| `RoutineOccurrence`                         | Horário que uma `Routine` já gerou, e a atividade que ela ainda gerencia   |
| `OccupancySnapshot`                         | Ocupação de uma clínica no fim de cada dia, pros relatórios                |

## Decisões de modelagem

Coisas que não ficam óbvias só olhando os campos:

| Onde                                                    | Por quê                                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Clinic.activities` vs. `Clinic.scheduledActivities`    | O primeiro é texto livre dos serviços oferecidos; o segundo aponta pra agenda (`Activity`). Nomes diferentes de propósito.                                                |
| `Room`, `Routine`                                       | Sem tela própria no app mobile — a gestão é do web app. O mobile só lista quartos com leito livre ao vincular ou cadastrar um idoso, continua exibindo `Resident.roomNumber` e nunca enxerga uma `Routine`. |
| `Resident.roomNumber`                                   | É um _getter_ (`room?.number`), não uma coluna — mantém o contrato do mobile sem duplicar o dado de `Resident.room`. Toda resposta de idoso traz `roomNumber` (nulo sem vínculo). |
| `Resident.healthNotes`                                  | Opcional: o cadastro walk-in não pede anotações de saúde. Nulo até alguém preencher. |
| `Resident.clinicId` / `roomId`                          | Nulos antes do primeiro vínculo e depois de uma desvinculação/alta. Histórico e responsáveis continuam existindo mesmo sem clínica.                                       |
| `Guardian` ↔ `Resident`                                 | N:N de verdade (`guardian_resident`) — um responsável pode acompanhar idosos em clínicas diferentes, um idoso pode ter mais de um responsável.                            |
| `Activity` → `Resident`                                 | Não existe FK direto — a relação passa por `ActivityParticipant`, que carrega o status individual de cada idoso na atividade.                                             |
| `ActivityParticipant.registeredBy`                      | Auditoria interna (quem da equipe registrou) — nunca deve aparecer num DTO de resposta pra um `guardian`. `rating`/`comment` são visíveis ao responsável, esse campo não. |
| `HealthRecord.recordedBy`                              | Mesma regra do `registeredBy`: a equipe vê quem registrou a medição, o responsável não. `type` é o enum `health_record_type` (`bloodPressure`, `glucose`, `weight`, `temperature`, `heartRate`, `other`); o valor continua texto com a unidade (`130/85 mmHg`). |
| `Activity.medicationId` / `routineId`                   | Só preenchidos quando a atividade é uma dose de medicação ou foi gerada por uma `Routine`, respectivamente.                                                               |
| `Routine.residents` / `rooms`                           | Só preenchidos conforme `Routine.scope`. `active = false` pausa a geração e apaga as atividades futuras ainda gerenciadas pela rotina; o histórico fica.                  |
| `Medication.endDate`                                    | Nulo significa tratamento contínuo, sem previsão de término.                                                                                                              |
| `UserFeedback.authorId`, `NotificationRecipient.userId` | FKs polimórficas (`StaffMember` ou `Guardian`, conforme `authorRole`/`userRole`) — sem relação direta possível no TypeORM, resolvidas na camada de aplicação.             |
| `UserFeedback.clinicIds`                                | Fotografia das clínicas do autor no envio (`uuid[]`, sem FK): o feedback é sobre o app, mas cada clínica vê o de quem é dela. Um idoso que muda de clínica depois não leva o feedback antigo junto. |
| `NotificationRecipient`                                 | Substitui o `audience` genérico do mock original: como leitura é por usuário, cada destinatário tem sua própria linha e seu próprio `readAt`.                             |
| `StaffRole`                                             | Só `COORDINATOR`/`NURSE` (`ROLES_THAT_MANAGE_REQUESTS`) aprovam/recusam solicitações e desvinculam idosos — `CAREGIVER` não.                                              |
| `StaffMember.cpf`, `Guardian.cpf`                       | Criptografados em repouso (AES-256-GCM, chave em `CPF_ENCRYPTION_KEY`) via transformer da coluna. Como cada gravação gera um texto cifrado diferente, não dá pra buscar nem impor unicidade por CPF no banco. A API valida os dígitos verificadores, grava só os 11 dígitos e nunca devolve o CPF inteiro — as respostas trazem `maskedCpf` (`•••.•••.•••-25`). |
| `StaffMember.deactivatedAt`                              | Soft delete: colaborador desativado some da listagem padrão, não loga mais e tem as sessões revogadas, mas a linha e o histórico ficam. |
| `StaffMember.password`, `Guardian.password`             | Hash argon2id, `select: false` na entidade. Nulo enquanto a pessoa não definiu a senha (convite pendente) — essa conta não consegue logar.                                |

## Rodando localmente

Tudo roda em Docker — API, Postgres e [Mailpit](https://mailpit.axllent.org/) (SMTP de desenvolvimento).

```bash
cp .env.example .env   # preencha os segredos (os comandos pra gerar estão no próprio arquivo)
docker compose up --build -d
docker compose run --rm api-dev npm run db:migrate
docker compose run --rm api-dev npm run db:seed
```

O seed cria a clínica "Residencial Vida Plena" com uma coordenadora (`coordenadora@caresenior.dev`), uma enfermeira (`enfermeira@caresenior.dev`), um cuidador (`cuidador@caresenior.dev`) e uma responsável (`responsavel@caresenior.dev`), todos com a senha `careSenior123`, além de um medicamento da idosa Maria (Losartana) e três atividades de hoje dela (a dose da Losartana e o café concluídos, a fisioterapia pendente) de duas medições de hoje (pressão e glicose), de uma troca de recados com a família, de uma solicitação de saída pendente dela, de dois feedbacks do app, de um mês de histórico de ocupação, de duas rotinas (aferição de pressão diária e roda de música no quarto 12B — as atividades delas aparecem na próxima execução do job, de hora em hora) e de uma solicitação de vínculo pendente (`vinculo-pendente@caresenior.dev`). Os e-mails enviados pela API (recuperação de senha) aparecem no Mailpit em `http://localhost:8025` — use `SMTP_HOST=mailpit` e `SMTP_PORT=1025` no `.env`.

`DB_HOST` no `.env` aponta pro nome do serviço (`db`), não `localhost` — de dentro do container da API, `localhost` seria o próprio container.

Todas as rotas ficam sob `/api/v1`. Documentação interativa da API (Swagger/OpenAPI, gerada automaticamente a partir dos DTOs) fica em `http://localhost:3000/api/docs` — abrir `http://localhost:3000` já redireciona pra lá — e a spec em JSON em `http://localhost:3000/api/docs-json`.

A imagem da `api` só tem dependências de produção; lint e testes rodam no serviço `api-dev`, que reaproveita o estágio de build com as devDependencies:

```bash
docker compose run --rm api-dev npm run lint
docker compose run --rm api-dev npm test
docker compose run --rm api-dev npm run test:e2e
```

## O que falta implementar

Hoje existem as entidades TypeORM, o schema SQL, a autenticação (`/auth`) e os módulos de clinics, staff, guardians, residents, rooms, activities, medications, outing-requests, health-records, messages, notifications, feedback, routines e reports — todas as rotas das tabelas abaixo estão implementadas (✅). O que ainda falta fora delas está logo abaixo. O contrato de API abaixo é o mapeamento pra atender os dois clientes (mobile + web) sobre a mesma base de dados; "Cliente" na última coluna indica quem consome cada rota hoje, só pra saber o que quebra se o contrato mudar.

Além dos endpoints, falta o upload de fotos (`photoPath`). Os medicamentos informados no autocadastro e no cadastro walk-in não têm rota própria: o app chama `POST /medications` uma vez por medicamento logo depois de criar o idoso.

**Convenções gerais** (padrão NestJS):

- Prefixo de versão: `/api/v1/...`.
- Recursos no plural, kebab-case (`/outing-requests`, não `/outingRequest`).
- `GET` de lista aceita filtro via query string (`?clinicId=`, `?residentId=`, `?status=`, `?from=&to=`) — nunca por segmento de rota além do primeiro nível de aninhamento.
- Aninhamento de no máximo 1 nível, só quando o sub-recurso não existe sozinho fora do pai (`/residents/:id/guardians`); o resto é rota plana com filtro.
- `PATCH` pra atualização parcial — nunca `PUT`. Campo omitido mantém o valor; `null` limpa um campo opcional e é recusado (`400`) num campo obrigatório.
- Ação que não é CRUD puro (aprovar, iniciar, desvincular) vira sub-rota verbo no infinitivo: `POST /resource/:id/acao`.
- Toda rota exige o `JwtAuthGuard` (global) — rotas abertas são marcadas com `@Public()`. Rotas restritas por cargo usam `@Roles(...ROLES_THAT_MANAGE_REQUESTS)` (valores de `StaffRole`), checado pelo `RolesGuard`; sem `@Roles`, qualquer usuário autenticado passa e a checagem de propriedade fica no service. O usuário logado chega no controller via `@CurrentUser()` (`AuthenticatedUser`: `id`, `role`, `staffRole?`, `clinicId?`). Decorators, guards e esse tipo ficam em `src/common/`.
- Entrada/saída tipadas por DTO (`CreateXDto`, `UpdateXDto`, `XResponseDto`) com `class-validator`/`class-transformer`. O `XResponseDto` de `ActivityParticipant` **não inclui `registeredBy`**, e o de `HealthRecord` não inclui `recordedBy`, quando quem pediu é `guardian` — ver "Decisões de modelagem" acima.
- Paginação padrão em toda lista (`?page=&limit=`).
- Data-hora de entrada (`scheduledTime`, `?from=&to=`) em ISO 8601 **com fuso** (`Z` ou `±hh:mm`, ex.: `2026-10-13T10:00:00-03:00`) — sem fuso é `400`, pra o horário nunca depender do fuso do servidor. As respostas vêm em UTC.

### Auth

| Método | Endpoint                         | Descrição                                                                        | Cliente | Observação                                      |
| ------ | -------------------------------- | -------------------------------------------------------------------------------- | ------- | ----------------------------------------------- |
| POST   | `/auth/staff/login`              | Login de colaborador                                                             | Ambos   | ✅ implementado                                  |
| POST   | `/auth/guardian/login`           | Login de responsável                                                             | Mobile  | ✅ implementado                                  |
| POST   | `/auth/refresh`                  | Troca o refresh token por um novo par de tokens                                  | Ambos   | ✅ implementado                                  |
| POST   | `/auth/logout`                   | Invalida a sessão do refresh token enviado                                       | Ambos   | ✅ implementado                                  |
| GET    | `/auth/me`                       | Usuário logado (colaborador ou responsável)                                      | Ambos   | ✅ implementado                                  |
| POST   | `/auth/staff/forgot-password`    | Envia por e-mail o link de redefinição de senha                                  | Ambos   | ✅ implementado — sempre `204`                   |
| POST   | `/auth/guardian/forgot-password` | Idem, para responsável                                                           | Mobile  | ✅ implementado — sempre `204`                   |
| POST   | `/auth/reset-password`           | Define a nova senha a partir do token do e-mail (body: `token`, `password`)      | Ambos   | ✅ implementado                                  |
| POST   | `/auth/guardian/register`        | Autocadastro do responsável + idoso (2 passos consolidados)                      | Mobile  | ✅ implementado — idoso fica sem clínica; já devolve a sessão, como o login; `409` se o e-mail existir |
| POST   | `/auth/staff/accept-invite`      | Define a senha do colaborador recém-cadastrado (body: `token`, `password`)       | Web     | ✅ implementado — completa o `POST /staff`; `204`, sem login automático; `400` se a conta já tem senha |
| POST   | `/auth/guardian/accept-invite`   | Define a senha do responsável cadastrado via walk-in (body: `token`, `password`) | Ambos   | ✅ implementado — completa o `POST /guardians`; `204`; `400` se a conta já tem senha |

**Sessão:** o login devolve um access token JWT (`Authorization: Bearer`, 15 min por padrão, assinado com `JWT_SECRET`, payload `{ sub, role, staffRole?, clinicId? }`) e um refresh token JWT (30 dias, assinado com `JWT_REFRESH_SECRET`) ligado a uma linha de `auth_sessions`. Cada `POST /auth/refresh` gira o refresh token; reapresentar um refresh já usado derruba a sessão inteira (sinal de que o token vazou). `logout` e `reset-password` revogam sessões, mas um access token já emitido continua válido até expirar.

**Web vs. mobile:** o mobile recebe o `refreshToken` no body e o devolve no body de `refresh`/`logout`. O web app envia o header `X-Client-Platform: web` e recebe o refresh token só num cookie `httpOnly`, `SameSite=Strict`, restrito a `/api/v1/auth` — as chamadas do web precisam de `credentials: 'include'`, e a origem dele precisa estar em `CORS_ORIGIN`. Esse header é a **única exceção** à regra de nunca ramificar por cliente: ele escolhe só como o refresh token é entregue, nunca autorização ou regra de negócio.

**Segurança:** senhas com argon2id (mínimo 8 caracteres); login, `forgot-password` e `reset-password` limitados a 5 tentativas por minuto por IP + e-mail; respostas de login e `forgot-password` não revelam se o e-mail existe. O link de redefinição (`PASSWORD_RESET_URL?token=...`) vale 1 hora, é de uso único e pedir outro invalida o anterior.

> **De onde vem a senha de quem não se autocadastrou:** `POST /staff` e `POST /guardians` (cadastro pela equipe) criam o registro **sem senha** e enviam por e-mail um link de convite (`STAFF_INVITE_URL?token=...` ou `GUARDIAN_INVITE_URL?token=...`, válido por 72 horas) pra pessoa definir a própria senha em `/auth/*/accept-invite`. Até lá, a conta existe mas não consegue logar. Se o link expirar ou o e-mail não chegar, "Esqueci minha senha" funciona também pra conta sem senha e serve de reenvio. Um convite nunca sobrescreve uma senha já definida.

> **Troca de e-mail feita pela equipe** (`PATCH /staff/:id`, `PATCH /guardians/:id`): só vale pra conta **ainda não ativada** (sem senha) — é a correção de um e-mail digitado errado no cadastro. Os links já enviados ao endereço antigo deixam de valer e o convite vai pro endereço novo. Conta ativada responde `409`: trocar o e-mail de login de outra pessoa entregaria a conta a quem controla o endereço novo, via "Esqueci minha senha".

### Clinics

| Método | Endpoint       | Descrição                                                    | Cliente | Observação                                                    |
| ------ | -------------- | ------------------------------------------------------------ | ------- | ------------------------------------------------------------- |
| GET    | `/clinics`     | Lista clínicas, paginada (`?search=` por nome ou endereço)   | Mobile  | ✅ implementado — responsável pré-vínculo                      |
| GET    | `/clinics/:id` | Detalhe institucional                                        | Ambos   | ✅ implementado                                                |
| PATCH  | `/clinics/:id` | Editar dados institucionais (inclui latitude/longitude)      | Web     | ✅ implementado — `@Roles(COORDINATOR, NURSE)`, só a própria clínica; foto ainda não editável (falta definir upload) |

### Staff

Toda rota de staff é restrita a colaboradores e à clínica de quem chama. Coordenadora e enfermeira (`ROLES_THAT_MANAGE_REQUESTS`) gerenciam a equipe, mas só a coordenadora cria, edita, promove para ou desativa uma coordenadora. Ninguém desativa a si mesmo, e a clínica nunca fica sem coordenadora ativa (`409`).

| Método | Endpoint     | Descrição                                                                  | Cliente | Observação                                                                        |
| ------ | ------------ | -------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| GET    | `/staff`     | Lista colaboradores (`?search=`, `?staffRole=`, `?includeInactive=`, `?clinicId=`) | Web     | ✅ implementado — tela "Colaboradores"; desativados ficam de fora por padrão       |
| POST   | `/staff`     | Cadastrar colaborador (envia o convite por e-mail)                         | Web     | ✅ implementado — `@Roles(COORDINATOR, NURSE)`                                     |
| GET    | `/staff/me`  | Perfil do colaborador logado                                               | Ambos   | ✅ implementado                                                                    |
| GET    | `/staff/:id` | Detalhe                                                                    | Web     | ✅ implementado                                                                    |
| PATCH  | `/staff/me`  | Editar o próprio perfil (nome, cpf)                                        | Mobile  | ✅ implementado — foto aguarda a definição de upload                               |
| PATCH  | `/staff/:id` | Editar colaborador (nome, e-mail, cpf, `staffRole`)                        | Web     | ✅ implementado — `@Roles(COORDINATOR, NURSE)`; e-mail só de conta não ativada (`409`), e o convite é reenviado |
| DELETE | `/staff/:id` | Desativar colaborador                                                      | Web     | ✅ implementado — soft delete (`deactivatedAt`), revoga as sessões; `204`          |

### Guardians

O responsável só vê o próprio cadastro. Um colaborador vê os responsáveis que têm a ver com a clínica dele — algum idoso vinculado a ela, ou que contataram a clínica na busca — e nunca vê `contactedClinicIds` (uma clínica não sabe quais outras a família procurou).

| Método | Endpoint                           | Descrição                                                         | Cliente | Observação                                                                                  |
| ------ | ---------------------------------- | ----------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| POST   | `/guardians`                       | Cadastro walk-in (responsável + idoso num quarto da clínica)      | Ambos   | ✅ implementado — qualquer colaborador; quarto precisa ter leito livre; envia o convite       |
| GET    | `/guardians/:id`                   | Detalhe                                                           | Ambos   | ✅ implementado                                                                              |
| PATCH  | `/guardians/me`                    | Editar o próprio perfil (nome, cpf)                               | Mobile  | ✅ implementado — foto aguarda a definição de upload                                         |
| PATCH  | `/guardians/:id`                   | Editar responsável (nome, e-mail, cpf — uso administrativo)       | Web     | ✅ implementado — qualquer colaborador da clínica relacionada; e-mail só de conta não ativada (`409`), e o convite é reenviado |
| POST   | `/guardians/:id/contact-clinic`    | Marcar clínica como contatada (`?clinicId=`)                      | Mobile  | ✅ implementado — só o próprio responsável; idempotente                                      |
| GET    | `/guardians/pending-link-requests` | Fila de vínculo pendente (`?clinicId=`), paginada por responsável | Ambos   | ✅ implementado — `@Roles(COORDINATOR, NURSE)`; `PendingLinkRequest` não é persistida        |

### Residents

O responsável vê os próprios idosos, vinculados ou não. Um colaborador vê os idosos da clínica dele e, antes do vínculo, os idosos cujo responsável contatou a clínica (é a solicitação de vínculo). O perfil é do responsável até o vínculo e da equipe da clínica depois dele. Ocupar um leito (`link`, `change-room`) trava a linha do quarto e confere a capacidade na mesma transação (`409` com o quarto cheio).

| Método | Endpoint                               | Descrição                                                           | Cliente | Observação                                       |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------ | ------- | ------------------------------------------------------ |
| GET    | `/residents`                           | Lista (`?clinicId=`, `?guardianId=`, `?search=` por nome)           | Ambos   | ✅ implementado                                   |
| GET    | `/residents/:id`                       | Detalhe                                                             | Ambos   | ✅ implementado                                   |
| PATCH  | `/residents/:id`                       | Editar perfil (nome, idade, saúde, humor, peculiaridades, contato de emergência) | Ambos   | ✅ implementado — responsável só pré-vínculo; depois, qualquer colaborador da clínica; foto aguarda a definição de upload |
| POST   | `/residents/:id/link`                  | Aceitar vínculo — preenche `clinicId`/`roomId` (`roomId` no body)   | Ambos   | ✅ implementado — `@Roles(COORDINATOR, NURSE)`; só com solicitação pendente pra clínica; `409` se já vinculado |
| POST   | `/residents/:id/discharge`             | Desvincular/dar alta                                                | Ambos   | ✅ implementado — `@Roles(COORDINATOR, NURSE)`, só idoso da própria clínica |
| POST   | `/residents/:id/change-room`           | Trocar de quarto (`roomId` no body)                                 | Web     | ✅ implementado — qualquer colaborador da clínica; quarto precisa ter leito livre |
| GET    | `/residents/:id/guardians`             | Responsáveis do idoso, paginado                                     | Ambos   | ✅ implementado                                   |
| POST   | `/residents/:id/guardians`             | Adicionar mais um responsável                                       | Ambos   | ✅ implementado — `@Roles(COORDINATOR, NURSE)`, só idoso da própria clínica, como a remoção; cria a conta e envia o convite; avisa os demais responsáveis; `409` se o e-mail existir |
| DELETE | `/residents/:id/guardians/:guardianId` | Remover um responsável específico                                   | —       | ✅ implementado — `@Roles(COORDINATOR, NURSE)`, só idoso da própria clínica; desfaz só o vínculo, a conta do responsável continua; o idoso nunca fica sem responsável (`409`); `204`. Sem tela ainda |

### Rooms

Só colaboradores, e só os quartos da própria clínica. Cada quarto vem com os ocupantes atuais (nome e idade), `freeBeds` e `status`: `vacant` quando tem pelo menos um leito livre (é o filtro dos modais de vínculo e troca de quarto), `occupied` quando está lotado. A capacidade nunca fica abaixo do número de ocupantes, e o número do quarto é único na clínica (`409` nos dois casos).

| Método | Endpoint     | Descrição                                                    | Cliente | Observação                                                       |
| ------ | ------------ | ------------------------------------------------------------ | ------- | ---------------------------------------------------------------- |
| GET    | `/rooms`     | Lista (`?clinicId=`, `?status=vacant\|occupied`), paginada   | Ambos   | ✅ implementado — tela "Quartos" e escolha de quarto no vínculo/walk-in |
| POST   | `/rooms`     | Cadastrar quarto (número, andar, ala, capacidade)            | Web     | ✅ implementado — `@Roles(COORDINATOR, NURSE)`                    |
| GET    | `/rooms/:id` | Detalhe                                                      | Web     | ✅ implementado                                                   |
| PATCH  | `/rooms/:id` | Editar quarto                                                | Web     | ✅ implementado — `@Roles(COORDINATOR, NURSE)`                    |
| DELETE | `/rooms/:id` | Remover quarto vazio                                         | Web     | ✅ implementado — `@Roles(COORDINATOR, NURSE)`; com idoso dentro, `409`; `204` |

### Activities

Uma atividade é da clínica e compartilhada por um ou mais idosos (`participants`), cada um com o próprio status. Qualquer colaborador da clínica agenda, edita e registra o andamento. O responsável vê só as atividades dos próprios idosos e, dentro delas, só os participantes que são idosos dele — nunca a nota, o comentário ou o motivo de pulo do idoso de outra família, nem quem da equipe registrou (`registeredBy`). Toda mudança numa atividade trava a linha dela, então uma edição nunca entra depois de um participante ter começado.

Status de participante: `pending` → `inProgress` (opcional, via `start-all`) → `completed` ou `skipped`, uma vez só (`409` se já tiver desfecho). `late` não é gravado: a resposta mostra `late` pra um participante ainda `pending` cujo horário já passou. `cancelled` é da atividade inteira: `cancel` encerra todo participante ainda `pending` ou `inProgress`, com o motivo visível ao responsável, e mantém o desfecho de quem já concluiu ou pulou. Encerrar uma medicação cancela do mesmo jeito as doses futuras dela. Uma atividade gerada por rotina que foi cancelada fica como histórico — a rotina não a apaga nem gera o horário de novo.

| Método | Endpoint                                            | Descrição                                                     | Cliente | Observação          |
| ------ | --------------------------------------------------- | ------------------------------------------------------------- | ------- | ------------------- |
| GET    | `/activities`                                       | Lista (`?clinicId=`, `?residentId=`, `?from=&to=`), por horário | Ambos   | ✅ implementado     |
| POST   | `/activities`                                       | Agendar atividade (um ou mais idosos)                         | Ambos   | ✅ implementado — só idosos da própria clínica; `medicationId` só numa atividade `medication` com um único participante, o idoso da prescrição ativa; foto ainda não |
| GET    | `/activities/:id`                                   | Detalhe + participantes                                       | Ambos   | ✅ implementado     |
| PATCH  | `/activities/:id`                                   | Editar atividade ainda não iniciada (inclusive participantes) | Ambos   | ✅ implementado — `409` depois que algum participante saiu de `pending` |
| POST   | `/activities/:id/start-all`                         | Inicia todos os participantes ainda não iniciados             | Mobile  | ✅ implementado     |
| POST   | `/activities/:id/participants/:residentId/complete` | Concluir participante (body: `rating`, `comment`)             | Mobile  | ✅ implementado — `rating` de 1 a 5, os dois opcionais |
| POST   | `/activities/:id/participants/:residentId/skip`     | Pular participante (body: `reason`)                           | Mobile  | ✅ implementado — `reason` obrigatório, visível ao responsável |
| POST   | `/activities/:id/complete-batch`                    | Concluir em lote (body: `residentIds[]`, `rating`, `comment`) | Mobile  | ✅ implementado — "Selecionar vários"; tudo ou nada |
| POST   | `/activities/:id/skip-batch`                        | Pular em lote (body: `residentIds[]`, `reason`)               | Mobile  | ✅ implementado — tudo ou nada |
| POST   | `/activities/:id/cancel`                            | Cancelar a atividade (body: `reason`)                         | Ambos   | ✅ implementado — `409` se ninguém mais estiver em aberto; avisa as famílias de quem foi cancelado |

### Routines

Regra recorrente da clínica (título, tipo, horário `HH:mm` de Brasília, dias da semana, instruções) que gera as `Activity` da agenda. Qualquer colaborador da clínica cria, edita, pausa e remove; o responsável nunca enxerga uma rotina. O escopo diz quem participa: `allResidents` (os idosos da clínica), `specificResidents` (`residentIds`) ou `specificRoom` (`roomIds`, um ou mais quartos — quem mora neles). As instruções viram o `detail` de cada atividade gerada.

- **Geração:** a rotina mantém a agenda preenchida pelos próximos 7 dias — na criação e num job de hora em hora (`@nestjs/schedule`). Cada horário é gerado uma vez só (`routine_occurrences`), mesmo com mais de uma instância da API.
- **Atividade gerenciada pela rotina:** futura, sem ninguém iniciado e não editada à mão. Só essas mudam sozinhas: o job ajusta os participantes a quem a rotina cobre agora (quem entrou na clínica ou no quarto entra, quem saiu sai), e editar, pausar ou remover a rotina as apaga e (se ela segue ativa) gera de novo.
- **Histórico:** atividade passada, iniciada ou editada à mão (`PATCH /activities/:id`, que a desvincula da geração) nunca é apagada pela rotina. Ao remover a rotina, essas ficam com `routineId: null`.

| Método | Endpoint               | Descrição                                        | Cliente | Observação              |
| ------ | ---------------------- | ------------------------------------------------ | ------- | ----------------------- |
| GET    | `/routines`            | Lista (`?clinicId=`, `?active=`, `?search=` no título), por horário | Web     | ✅ implementado — tela "Agenda & Rotinas" |
| POST   | `/routines`            | Criar rotina recorrente                          | Web     | ✅ implementado — já gera os próximos 7 dias |
| GET    | `/routines/:id`        | Detalhe                                          | Web     | ✅ implementado         |
| PATCH  | `/routines/:id`        | Editar (dias, horário, escopo, instruções)       | Web     | ✅ implementado — refaz as atividades gerenciadas; mudar o escopo pra `specificResidents`/`specificRoom` exige a lista nova |
| PATCH  | `/routines/:id/toggle` | Ativar/pausar                                    | Web     | ✅ implementado — pausar apaga as atividades gerenciadas; retomar gera de novo |
| DELETE | `/routines/:id`        | Remover rotina                                   | Web     | ✅ implementado — `204`; o histórico fica |

### Medications

Uma prescrição é de um idoso. A permissão é a mesma do perfil do idoso: enquanto ele não tem clínica, quem cadastra e edita é o responsável (inclusive os medicamentos do autocadastro); depois do vínculo, qualquer colaborador da clínica. Quem vê o idoso vê as prescrições dele — inclusive a equipe de uma clínica contatada, na revisão da solicitação de vínculo. Encerrar o tratamento (`deactivate`) guarda a prescrição como histórico e fecha `endDate` em agora (se ainda estava aberto ou no futuro); prescrição encerrada não é mais editada (`409`). Uma dose agendada é uma `Activity` do tipo `medication` com `medicationId`. Ao encerrar, as doses ainda por vir saem da agenda: o participante ainda em aberto fica `cancelled` com o motivo "Tratamento encerrado" (visível ao responsável), então ninguém é lembrado de um remédio suspenso; o mesmo vale pras doses depois de um `endDate` antecipado. Dose passada ou já registrada fica como está.

| Método | Endpoint                      | Descrição                                               | Cliente | Observação                                  |
| ------ | ----------------------------- | ------------------------------------------------------- | ------- | ------------------------------------------- |
| GET    | `/medications`                | Lista (`?residentId=`, `?clinicId=`, `?active=`)        | Ambos   | ✅ implementado — ativas primeiro, por nome |
| POST   | `/medications`                | Cadastrar prescrição                                    | Ambos   | ✅ implementado — `startDate` padrão agora; sem `endDate` é tratamento contínuo |
| GET    | `/medications/:id`            | Detalhe                                                 | Ambos   | ✅ implementado                             |
| PATCH  | `/medications/:id`            | Editar prescrição                                       | Ambos   | ✅ implementado — `endDate: null` volta a ser contínuo |
| PATCH  | `/medications/:id/deactivate` | Encerrar tratamento                                     | Ambos   | ✅ implementado — preferir isso a `DELETE`, mantém histórico; cancela as doses futuras |

### Health records

Medições de sinais vitais de um idoso, sempre registradas pela equipe da clínica dele (qualquer cargo) e só pra idoso vinculado. Quem vê o idoso vê as medições — o responsável sem `recordedBy`. `recordedAt` é o momento da medição: padrão agora, nunca no futuro.

| Método | Endpoint          | Descrição                                                                  | Cliente | Observação |
| ------ | ----------------- | -------------------------------------------------------------------------- | ------- | ---------- |
| GET    | `/health-records` | Lista (`?residentId=`, `?clinicId=`, `?type=`, `?from=&to=`), mais recente primeiro | Ambos   | ✅ implementado |
| POST   | `/health-records` | Registrar dado de saúde                                                    | Mobile  | ✅ implementado — só colaborador da clínica do idoso |

### Outing requests

O responsável pede a saída de um idoso **vinculado** (é a clínica dele que aprova) e acompanha todas as solicitações dos próprios idosos, inclusive as feitas por outro responsável do mesmo idoso. A equipe vê as solicitações dos idosos da própria clínica; só coordenadora e enfermeira dessa clínica respondem, uma vez só — a resposta é um `UPDATE` condicionado a `pending`, então duas respostas simultâneas não se sobrescrevem (`409` pra segunda). A saída precisa começar no futuro e a volta ser depois da saída (`400`).

| Método | Endpoint                       | Descrição                                                          | Cliente | Observação                     |
| ------ | ------------------------------ | ------------------------------------------------------------------ | ------- | ------------------------------ |
| GET    | `/outing-requests`             | Lista (`?residentId=`, `?clinicId=`, `?status=`, `?search=` por idoso ou responsável) | Ambos   | ✅ implementado — mais recentes primeiro |
| POST   | `/outing-requests`             | Criar solicitação                                                  | Mobile  | ✅ implementado — só responsável do idoso; idoso sem clínica é `409` |
| GET    | `/outing-requests/:id`         | Detalhe                                                            | Ambos   | ✅ implementado                |
| POST   | `/outing-requests/:id/approve` | Aprovar                                                            | Ambos   | ✅ implementado — `@Roles(COORDINATOR, NURSE)`, só a própria clínica |
| POST   | `/outing-requests/:id/reject`  | Recusar (body: `reason`)                                           | Ambos   | ✅ implementado — `@Roles(COORDINATOR, NURSE)`; o motivo é visível ao responsável |
| DELETE | `/outing-requests/:id`         | Cancelar solicitação ainda pendente                                | Mobile  | ✅ implementado — só quem pediu; `409` se já respondida; `204`. Sem tela ainda |

### Messages

Recados entre a família e a clínica sobre um idoso — lista simples, sem tempo real. Escrevem e leem o responsável do idoso e qualquer colaborador da clínica **atual** dele; idoso sem clínica não tem com quem trocar recado (`409`). `senderId`/`senderRole`/`senderName` vêm da conta autenticada, nunca do corpo (o nome é gravado como estava no envio).

| Método | Endpoint    | Descrição                                     | Cliente | Observação |
| ------ | ----------- | --------------------------------------------- | ------- | ---------- |
| GET    | `/messages` | Lista (`?residentId=`), mais recente primeiro | Mobile  | ✅ implementado |
| POST   | `/messages` | Enviar recado (`residentId`, `text`)          | Mobile  | ✅ implementado |

### Feedback

Avaliação do app (nota de 1 a 5 e mensagem), enviada por qualquer colaborador ou responsável; autor e nome vêm da conta autenticada. Cada feedback guarda, no envio, as clínicas de quem enviou (`clinicIds`, coluna interna que não sai na resposta): a clínica do colaborador, ou as clínicas dos idosos do responsável naquele momento — o responsável sem idoso vinculado não chega a nenhuma clínica. Coordenadora e enfermeira leem o feedback da própria clínica.

| Método | Endpoint    | Descrição                                      | Cliente | Observação        |
| ------ | ----------- | ---------------------------------------------- | ------- | ----------------- |
| GET    | `/feedback` | Lista (`?clinicId=`, `?authorRole=`), mais recente primeiro | Web     | ✅ implementado — `@Roles(COORDINATOR, NURSE)`, só a própria clínica; tela "Relatórios" |
| POST   | `/feedback` | Enviar feedback (`rating`, `message`)          | Mobile  | ✅ implementado |

### Notifications

Caixa de entrada do usuário logado (staff ou responsável), mais recente primeiro. Cada destinatário tem sua linha e seu `readAt`; a notificação de outra pessoa responde `404`. Não há `POST`: a própria API cria as notificações quando algo acontece, e a falha ao notificar é logada sem desfazer a ação que a disparou. Sem push ainda — o app consulta a lista (`?unread=true` dá o número do badge em `meta.total`).

| Evento                                    | Quem recebe                                                         |
| ----------------------------------------- | ------------------------------------------------------------------- |
| Nova solicitação de saída                 | Coordenadora e enfermeira da clínica do idoso                       |
| Saída aprovada/recusada (com o motivo)    | Responsáveis do idoso                                               |
| Recado novo                               | Responsáveis do idoso e, se veio da família, a equipe da clínica — nunca quem enviou |
| Vínculo aceito, alta registrada           | Responsáveis do idoso                                               |
| Novo responsável cadastrado pela clínica  | Os demais responsáveis do idoso                                     |
| Participante concluiu/pulou uma atividade, ou a atividade foi cancelada | Responsáveis daquele idoso (com nota, comentário ou motivo)         |
| Atividade começa em até 30 min (`upcomingEvent`/`medicationUpcoming`) | Equipe ativa da clínica — só se ainda há participante `pending` |
| Medicação sem registro 30 min depois do horário (`medicationOverdue`) | Equipe ativa da clínica                                |

Os lembretes vêm de um job a cada 5 minutos (`@nestjs/schedule`). Cada lembrete sai uma vez por atividade: a tabela `activity_reminders` registra o envio, e o `INSERT ... ON CONFLICT DO NOTHING` garante isso mesmo com mais de uma instância da API rodando o job.

| Método | Endpoint                  | Descrição               | Cliente | Observação |
| ------ | ------------------------- | ----------------------- | ------- | ---------- |
| GET    | `/notifications`          | Lista do usuário logado (`?unread=`) | Mobile  | ✅ implementado |
| PATCH  | `/notifications/:id/read` | Marcar como lida        | Mobile  | ✅ implementado — idempotente, mantém o primeiro `readAt` |
| PATCH  | `/notifications/read-all` | Marcar todas como lidas | Mobile  | ✅ implementado — `204` |

### Reports (exclusivo web)

Agregações só de leitura sobre a clínica de quem pede — qualquer colaborador, menos o resumo de feedback, que segue a regra de `GET /feedback` (coordenadora e enfermeira). `?clinicId=`, quando enviado, precisa ser a própria clínica. O período (`?from=&to=`, ISO 8601 com fuso) é por padrão os últimos 30 dias, com no máximo 366; os dias são datas de Brasília.

- **Conclusão e adesão** contam só o que já venceu (horário até agora): o que ainda vai acontecer não é atraso. `late` é participante ainda `pending` depois do horário; `cancelled` fica de fora. Adesão a medicação = doses `completed` / doses vencidas de atividades `medication`.
- **Ocupação ao longo do tempo** vem de `occupancy_snapshots`: um job de hora em hora regrava o retrato do dia de cada clínica, então cada dia passado guarda o último valor dele. O dia de hoje é calculado na hora; dias antes do primeiro retrato não têm ponto.
- Taxas vão de 0 a 1, com 4 casas, e são `null` quando não há o que medir.

| Método | Endpoint                        | Descrição                                            | Cliente | Observação |
| ------ | ------------------------------- | ---------------------------------------------------- | ------- | ---------- |
| GET    | `/reports/overview`             | Números do dashboard agora (`?clinicId=`): idosos, colaboradores ativos, leitos, solicitações pendentes | Web     | ✅ implementado |
| GET    | `/reports/activities-by-type`   | Atividades por `ActivityType` no período, todos os tipos | Web     | ✅ implementado |
| GET    | `/reports/medication-adherence` | Adesão no período e por dia                           | Web     | ✅ implementado |
| GET    | `/reports/activity-completion`  | Concluídas/puladas/atrasadas/em andamento e % no período | Web     | ✅ implementado |
| GET    | `/reports/occupancy`            | Ocupação de quartos por dia no período               | Web     | ✅ implementado |
| GET    | `/reports/feedback-summary`     | Média e histograma de notas no período               | Web     | ✅ implementado — `@Roles(COORDINATOR, NURSE)` |