# SEIA

Sistema de estoque para operações do agronegócio, com catálogo compartilhado por empresa, fornecedores, controle de entradas/saídas/ajustes e mural de atividade.

## Executar localmente

1. Configure as credenciais do Firebase no backend (`FIREBASE_API_KEY` e `firebase-key.json`, ou Application Default Credentials).
2. Na pasta `backend/src`, execute `uvicorn main:app --reload`.
3. Na pasta `frontend`, execute `npm install` e `npm run dev`.

Para registrar a primeira conta de administrador global, crie a conta no Firebase e configure `SEIA_SUPERADMIN_EMAIL` no `.env` como endereço inicial para o provisionamento. Após inicializar o banco com o backend, execute `python provisionar_admin_seia.py` em `backend/src` (ou passe o e-mail como argumento). A conta é cadastrada na tabela de usuários com perfil `admin_seia` e sem empresa. O e-mail não precisa estar verificado; o acesso global é concedido somente após registrar explicitamente o UID Firebase no banco pelo comando. Administradores globais adicionais também são provisionados individualmente pelo mesmo comando; somente contas Firebase já existentes são aceitas.

Na inicialização, o backend cria as tabelas novas e migra o `seia.db` existente, preservando produtos e fornecedores. Os registros antigos sem empresa são atribuídos a uma empresa legada. A API valida o token Firebase e limita produtos, fornecedores, movimentações e avisos à empresa do usuário.

Para criar dados demonstrativos em um banco local vazio, defina `SEIA_SEED_DEMO=true` antes de iniciar o backend (no PowerShell: `$env:SEIA_SEED_DEMO="true"`). A seed é executada somente quando ainda não existe nenhuma empresa e cria duas empresas, quatro fornecedores e seis produtos fictícios; ela não cria usuários, avisos ou movimentações. Deixe a opção desativada em ambientes de produção. Os usuários podem ser cadastrados manualmente pelo administrador da empresa.

## Empresas e usuários

- Administradores globais `admin_seia`, autenticados pelo Firebase e registrados no banco, podem cadastrar e administrar empresas pelo painel `/admin/empresas`. O cadastro cria também a conta Firebase do primeiro gerente da empresa.
- Ao selecionar **Acessar** em uma empresa, o admin global entra no contexto dela sem trocar de conta. A API recebe o ID selecionado e mantém os mesmos endpoints e CRUDs limitados à empresa ativa. A autorização global é validada pelo backend.
- O administrador e o gerente da empresa podem criar contas de funcionários pela página **Empresa**. Esse fluxo é autenticado; não existe cadastro público de usuários ou empresas.
- Login e recuperação de senha são as únicas rotas públicas. A autorização das rotas administrativas é validada pelo backend, independentemente do papel armazenado no navegador.
- Gerentes podem atualizar os dados da empresa, administrar avisos e criar funcionários. O administrador global pode criar outros gerentes e excluir uma empresa somente se ela ainda não tiver dados ou histórico.
- A exclusão da empresa é bloqueada enquanto houver produtos, fornecedores, movimentações ou avisos, para preservar o histórico.

Se a conexão com Firebase falhar por inspeção HTTPS/certificado corporativo, configure `REQUESTS_CA_BUNDLE` para apontar ao certificado raiz PEM confiável da organização antes de iniciar o backend. Não desative a validação TLS.

## Estoque e mural

- A página **Movimentações** registra entradas, saídas e ajustes para o saldo desejado, sempre identificando usuário, motivo e horário.
- Saídas que deixariam o estoque negativo são rejeitadas. O saldo inicial informado ao cadastrar um produto também é registrado como uma entrada.
- **Visão geral** reúne os avisos da empresa e as movimentações recentes com o usuário responsável. Administradores e gerentes podem criar, editar e remover avisos.

## Endpoints principais

- Públicos: `POST /login` e `POST /esqueci-senha`.
- Administração global: `GET/POST /admin/empresas`, `PUT/DELETE /admin/empresas/{empresa_id}`.
- Empresa autenticada: `GET/PUT/DELETE /empresas/me`, `POST /empresas/usuarios`.
- `GET/POST /movimentacoes`.
- `GET/POST /avisos`, `PUT/DELETE /avisos/{aviso_id}`.
- Produtos e fornecedores usam os endpoints existentes e agora exigem autenticação; os resultados são limitados à empresa autenticada.