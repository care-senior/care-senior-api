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
| `Activity.medicationId` / `routineId`                   | Só preenchidos quando a atividade é uma dose de medicação ou foi gerada por uma `Routine`, respectivamente.                                                               |
| `Routine.residents` / `rooms`                           | Só preenchidos conforme `Routine.scope`. `active = false` só pausa a geração de novas atividades, não apaga histórico.                                                    |
| `Medication.endDate`                                    | Nulo significa tratamento contínuo, sem previsão de término.                                                                                                              |
| `UserFeedback.authorId`, `NotificationRecipient.userId` | FKs polimórficas (`StaffMember` ou `Guardian`, conforme `authorRole`/`userRole`) — sem relação direta possível no TypeORM, resolvidas na camada de aplicação.             |
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

O seed cria a clínica "Residencial Vida Plena" com uma coordenadora (`coordenadora@caresenior.dev`), uma enfermeira (`enfermeira@caresenior.dev`), um cuidador (`cuidador@caresenior.dev`) e uma responsável (`responsavel@caresenior.dev`), todos com a senha `careSenior123`, além de duas atividades de hoje da idosa Maria (uma concluída, outra pendente) e de uma solicitação de vínculo pendente (`vinculo-pendente@caresenior.dev`). Os e-mails enviados pela API (recuperação de senha) aparecem no Mailpit em `http://localhost:8025` — use `SMTP_HOST=mailpit` e `SMTP_PORT=1025` no `.env`.

`DB_HOST` no `.env` aponta pro nome do serviço (`db`), não `localhost` — de dentro do container da API, `localhost` seria o próprio container.

Todas as rotas ficam sob `/api/v1`. Documentação interativa da API (Swagger/OpenAPI, gerada automaticamente a partir dos DTOs) fica em `http://localhost:3000/api/docs` — abrir `http://localhost:3000` já redireciona pra lá — e a spec em JSON em `http://localhost:3000/api/docs-json`.

A imagem da `api` só tem dependências de produção; lint e testes rodam no serviço `api-dev`, que reaproveita o estágio de build com as devDependencies:

```bash
docker compose run --rm api-dev npm run lint
docker compose run --rm api-dev npm test
docker compose run --rm api-dev npm run test:e2e
```

## O que falta implementar

Hoje existem as entidades TypeORM, o schema SQL, a autenticação (`/auth`) e os módulos de clinics, staff, guardians, residents, rooms e activities — as rotas prontas estão marcadas com ✅ nas tabelas abaixo; os demais domínios ainda não têm service, controller ou endpoint. O contrato de API abaixo é o mapeamento pra atender os dois clientes (mobile + web) sobre a mesma base de dados; "Cliente" na última coluna indica quem consome cada rota hoje, só pra saber o que quebra se o contrato mudar.

Além dos endpoints, faltam os medicamentos informados no autocadastro e no cadastro walk-in, que entram com o módulo de medications, e o upload de fotos (`photoPath`).

**Convenções gerais** (padrão NestJS):

- Prefixo de versão: `/api/v1/...`.
- Recursos no plural, kebab-case (`/outing-requests`, não `/outingRequest`).
- `GET` de lista aceita filtro via query string (`?clinicId=`, `?residentId=`, `?status=`, `?from=&to=`) — nunca por segmento de rota além do primeiro nível de aninhamento.
- Aninhamento de no máximo 1 nível, só quando o sub-recurso não existe sozinho fora do pai (`/residents/:id/guardians`); o resto é rota plana com filtro.
- `PATCH` pra atualização parcial — nunca `PUT`. Campo omitido mantém o valor; `null` limpa um campo opcional e é recusado (`400`) num campo obrigatório.
- Ação que não é CRUD puro (aprovar, iniciar, desvincular) vira sub-rota verbo no infinitivo: `POST /resource/:id/acao`.
- Toda rota exige o `JwtAuthGuard` (global) — rotas abertas são marcadas com `@Public()`. Rotas restritas por cargo usam `@Roles(...ROLES_THAT_MANAGE_REQUESTS)` (valores de `StaffRole`), checado pelo `RolesGuard`; sem `@Roles`, qualquer usuário autenticado passa e a checagem de propriedade fica no service. O usuário logado chega no controller via `@CurrentUser()` (`AuthenticatedUser`: `id`, `role`, `staffRole?`, `clinicId?`). Decorators, guards e esse tipo ficam em `src/common/`.
- Entrada/saída tipadas por DTO (`CreateXDto`, `UpdateXDto`, `XResponseDto`) com `class-validator`/`class-transformer`. O `XResponseDto` de `ActivityParticipant` **não inclui `registeredBy`** quando quem pediu é `guardian` — ver "Decisões de modelagem" acima.
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
| POST   | `/auth/staff/accept-invite`      | Define a senha do colaborador recém-cadastrado (body: `token`, `password`)       | Web     | ✅ implementado — completa o `POST /staff`; `204`, sem login automático |
| POST   | `/auth/guardian/accept-invite`   | Define a senha do responsável cadastrado via walk-in (body: `token`, `password`) | Ambos   | ✅ implementado — completa o `POST /guardians`; `204` |

**Sessão:** o login devolve um access token JWT (`Authorization: Bearer`, 15 min por padrão, assinado com `JWT_SECRET`, payload `{ sub, role, staffRole?, clinicId? }`) e um refresh token JWT (30 dias, assinado com `JWT_REFRESH_SECRET`) ligado a uma linha de `auth_sessions`. Cada `POST /auth/refresh` gira o refresh token; reapresentar um refresh já usado derruba a sessão inteira (sinal de que o token vazou). `logout` e `reset-password` revogam sessões, mas um access token já emitido continua válido até expirar.

**Web vs. mobile:** o mobile recebe o `refreshToken` no body e o devolve no body de `refresh`/`logout`. O web app envia o header `X-Client-Platform: web` e recebe o refresh token só num cookie `httpOnly`, `SameSite=Strict`, restrito a `/api/v1/auth` — as chamadas do web precisam de `credentials: 'include'`, e a origem dele precisa estar em `CORS_ORIGIN`. Esse header é a **única exceção** à regra de nunca ramificar por cliente: ele escolhe só como o refresh token é entregue, nunca autorização ou regra de negócio.

**Segurança:** senhas com argon2id (mínimo 8 caracteres); login, `forgot-password` e `reset-password` limitados a 5 tentativas por minuto por IP + e-mail; respostas de login e `forgot-password` não revelam se o e-mail existe. O link de redefinição (`PASSWORD_RESET_URL?token=...`) vale 1 hora, é de uso único e pedir outro invalida o anterior.

> **De onde vem a senha de quem não se autocadastrou:** `POST /staff` e `POST /guardians` (cadastro pela equipe) criam o registro **sem senha** e enviam por e-mail um link de convite (`STAFF_INVITE_URL?token=...` ou `GUARDIAN_INVITE_URL?token=...`, válido por 72 horas) pra pessoa definir a própria senha em `/auth/*/accept-invite`. Até lá, a conta existe mas não consegue logar. Se o link expirar ou o e-mail não chegar, "Esqueci minha senha" funciona também pra conta sem senha e serve de reenvio.

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
| PATCH  | `/staff/:id` | Editar colaborador (nome, e-mail, cpf, `staffRole`)                        | Web     | ✅ implementado — `@Roles(COORDINATOR, NURSE)`                                     |
| DELETE | `/staff/:id` | Desativar colaborador                                                      | Web     | ✅ implementado — soft delete (`deactivatedAt`), revoga as sessões; `204`          |

### Guardians

O responsável só vê o próprio cadastro. Um colaborador vê os responsáveis que têm a ver com a clínica dele — algum idoso vinculado a ela, ou que contataram a clínica na busca — e nunca vê `contactedClinicIds` (uma clínica não sabe quais outras a família procurou).

| Método | Endpoint                           | Descrição                                                         | Cliente | Observação                                                                                  |
| ------ | ---------------------------------- | ----------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| POST   | `/guardians`                       | Cadastro walk-in (responsável + idoso num quarto da clínica)      | Ambos   | ✅ implementado — qualquer colaborador; quarto precisa ter leito livre; envia o convite       |
| GET    | `/guardians/:id`                   | Detalhe                                                           | Ambos   | ✅ implementado                                                                              |
| PATCH  | `/guardians/me`                    | Editar o próprio perfil (nome, cpf)                               | Mobile  | ✅ implementado — foto aguarda a definição de upload                                         |
| PATCH  | `/guardians/:id`                   | Editar responsável (nome, e-mail, cpf — uso administrativo)       | Web     | ✅ implementado — qualquer colaborador da clínica relacionada                                |
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
| POST   | `/residents/:id/guardians`             | Adicionar mais um responsável                                       | Ambos   | ✅ implementado — qualquer colaborador da clínica; cria a conta e envia o convite; `409` se o e-mail existir |
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

Status de participante: `pending` → `inProgress` (opcional, via `start-all`) → `completed` ou `skipped`, uma vez só (`409` se já tiver desfecho). `late` não é gravado: a resposta mostra `late` pra um participante ainda `pending` cujo horário já passou. `cancelled` ainda não tem rota.

| Método | Endpoint                                            | Descrição                                                     | Cliente | Observação          |
| ------ | --------------------------------------------------- | ------------------------------------------------------------- | ------- | ------------------- |
| GET    | `/activities`                                       | Lista (`?clinicId=`, `?residentId=`, `?from=&to=`), por horário | Ambos   | ✅ implementado     |
| POST   | `/activities`                                       | Agendar atividade (um ou mais idosos)                         | Ambos   | ✅ implementado — só idosos da própria clínica; foto e medicamento ainda não |
| GET    | `/activities/:id`                                   | Detalhe + participantes                                       | Ambos   | ✅ implementado     |
| PATCH  | `/activities/:id`                                   | Editar atividade ainda não iniciada (inclusive participantes) | Ambos   | ✅ implementado — `409` depois que algum participante saiu de `pending` |
| POST   | `/activities/:id/start-all`                         | Inicia todos os participantes ainda não iniciados             | Mobile  | ✅ implementado     |
| POST   | `/activities/:id/participants/:residentId/complete` | Concluir participante (body: `rating`, `comment`)             | Mobile  | ✅ implementado — `rating` de 1 a 5, os dois opcionais |
| POST   | `/activities/:id/participants/:residentId/skip`     | Pular participante (body: `reason`)                           | Mobile  | ✅ implementado — `reason` obrigatório, visível ao responsável |
| POST   | `/activities/:id/complete-batch`                    | Concluir em lote (body: `residentIds[]`, `rating`, `comment`) | Mobile  | ✅ implementado — "Selecionar vários"; tudo ou nada |
| POST   | `/activities/:id/skip-batch`                        | Pular em lote (body: `residentIds[]`, `reason`)               | Mobile  | ✅ implementado — tudo ou nada |

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
