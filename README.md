# ROYAL BLACK — Site público

Interface separada do repositório privado MT4. Os dados de demonstração são ilustrativos e não representam resultados reais.

## GitHub Pages
Settings → Pages → Build and deployment → Source: GitHub Actions.

O workflow publica o diretório `dist` em `https://weslheyn.github.io/royal-black-web/`.

## Supabase (opcional, para dados reais)
Configure em Settings → Secrets and variables → Actions → Variables:
- `VITE_SUPABASE_URL`: `https://rjuzakgbrbpwehmvnoxa.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY`: chave **pública** (publishable/anon) do projeto.

Nunca insira service_role, senha, token do EA ou segredo administrativo no repositório ou em variáveis VITE_. Verifique políticas RLS e autenticação antes de habilitar o acesso real.

Sem essas variáveis, o site inicia em modo demonstração. Nenhuma operação real ou virtual é enviada pelo frontend.

O EA e os indicadores continuam exclusivamente no repositório privado.
