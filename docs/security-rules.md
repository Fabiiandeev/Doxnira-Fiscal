# Regras de Segurança para Ruflo

- **Não versionar** arquivos contendo certificados A1 ou chaves privadas.
- **Never log** tokens de API, credenciais ou XMLs contendo dados fiscais sensíveis.
- **Mascarar** CNPJ/CPF nos logs usando padrão `##.###.###/####-##` → `##.###.###/####-##` (ex.: `12.345.678/0001-90` → `##.###.###/####-##`).
- **Filtrar** variáveis de ambiente: `process.env` é sanitizado antes de ser passado para agentes.
- **Git ignore** a pasta `.ruflo/memory/` e qualquer arquivo temporário criado por Ruflo.
- **Sandbox**: agentes rodam em processos Node.js com limite de memória (`--max-old-space-size=256`).
- **Auditoria**: executar periodicamente `npx ruflo@latest security-audit` e revisar relatórios.
