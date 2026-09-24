# Celestial Rankings — projeto completo para Vercel

Exportação da versão publicada em 24/09/2026. O HTML, CSS, JavaScript e todas as imagens foram copiados sem alterações. O site existente não foi modificado nem transferido de hospedagem.

## Publicar na Vercel

1. Extraia este ZIP.
2. Envie o conteúdo da pasta `celestial-rankings-vercel` para um repositório Git de sua conta. `package.json` e `vercel.json` devem ficar na raiz do repositório.
3. Na Vercel, crie um projeto e importe esse repositório.
4. Use a raiz do projeto como **Root Directory**. A configuração incluída define **Framework Preset: Other**, **Build Command: npm run build** e **Output Directory: public**. Não é necessário instalar dependências.
5. Clique em **Deploy**.

Não são necessárias variáveis de ambiente para a versão atual. Este pacote está preparado para publicação, mas não foi implantado em uma conta Vercel durante a exportação.

Alternativa pelo terminal, com a CLI da Vercel disponível: execute `vercel` dentro da pasta do projeto e, depois, `vercel --prod` para publicar em produção.

## Executar localmente

Com Node.js 22 ou superior instalado:

```sh
npm run dev
```

Abra `http://localhost:3000`. Não abra o HTML diretamente por `file://`, pois o site usa módulos JavaScript.

```sh
npm run build
```

Esse comando valida os arquivos; não transforma nem recompila o design. `public/` já contém o código-fonte pronto para ser servido.

## Estrutura

- `public/index.html`: estrutura das páginas e navegação.
- `public/styles.css`: todos os estilos, responsividade e identidade visual.
- `public/app.js`: ranking, filtros, busca por tag, confrontos, detalhes e navegação.
- `public/data.js`: dados demonstrativos e cálculos de estatísticas.
- `public/motion.js`: animações e preferência de movimento reduzido.
- `public/*.png`: todas as imagens do projeto, incluindo logo, favicon e avatar.
- `vercel.json`: configuração da hospedagem.
- `package.json`: comandos de desenvolvimento e validação; sem dependências externas de execução.
- `scripts/serve.mjs`: servidor local de desenvolvimento.
- `scripts/verify.mjs`: validação de sintaxe e arquivos essenciais.
- `source-manifest.json`: identificação da versão e hashes dos arquivos exportados.

Os arquivos originais estavam em `dist/` e foram movidos juntos para `public/`, preservando caminhos relativos e conteúdo byte a byte. Não existe uma pasta `src/` separada: este é um projeto estático e os arquivos de `public/` são o código-fonte completo, sem minificação adicional.

## Funcionalidades preservadas

- Abas Treinos, Rankings e Sobre Nós.
- Ranking de treinos até o 10º lugar, filtros por mês e todos os tempos.
- Consulta de estatísticas por tag, incluindo jogadores fora do top 10.
- Confrontos por treino e detalhes dos integrantes e desempenho dos times.
- Layout de celular, controles padronizados e logo ampliada.
- Estados de carregamento, lista vazia e erro do ranking.
- Animações, imagens fornecidas e favicon atual.

A navegação usa fragmentos (`#treinos`, `#rankings`, `#sobre-nos`); não precisa de rewrites para rotas de servidor. As fontes continuam sendo carregadas do Google Fonts, como no site original.

## Dados e integrações

Os resultados continuam demonstrativos. Não há Supabase conectado, banco de dados, API própria ou código do Zeus BOT neste projeto. O ponto verde do Zeus BOT é um indicador visual, não monitora a conexão real. A tela de contato e as categorias futuras mantêm o comportamento atual.

Para uma integração futura, o ponto de partida é `public/data.js`. As funções `getDashboard`, `teamStats` e `getTeamPlayers` e a lista `sessions` atendem à interface atual. Chaves privadas de Supabase ou do bot devem permanecer em um backend, nunca em arquivos de `public/`.

## Conferência da exportação

```sh
node scripts/verify.mjs --original
```

Confere os hashes de todos os arquivos em relação à exportação original. Depois de editar o site, diferenças nesse comando são esperadas; a validação normal continua disponível com `npm run build`.

Foram verificados os hashes de todos os arquivos originais, a sintaxe dos módulos e a integridade do ZIP. Não foi realizada uma nova revisão visual em navegador nem uma implantação de teste na Vercel.

Documentação de configuração: https://vercel.com/docs/project-configuration/vercel-json
