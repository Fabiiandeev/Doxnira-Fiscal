# Checklist de Validação da Integração Ruflo

- [ ] `npm run lint` – sem warnings críticos.
- [ ] `npm run typecheck` – sem erros de TypeScript.
- [ ] `npm run build` – aplicação compila com sucesso.
- [ ] Verificar que `package.json` e lockfiles não foram alterados (`git diff --stat package.json pnpm-lock.yaml` deve estar vazio).
- [ ] **Testes CRUD** – executar `npm run test -- -t "CRUD"` e garantir 100% de passed.
- [ ] **Testes NF‑e** – executar `npm run test -- -t "NF-e"`.
- [ ] **Testes XML** – validar schemas com `npm run test -- -t "XML"`.
- [ ] **Testes Impostos** – rodar `npm run test -- -t "Impostos"`.
- [ ] **Testes SEFAZ/Rejeições** – executar `npm run test -- -t "SEFAZ"`.
- [ ] Conferir que a pasta `.ruflo/memory/` está no `.gitignore`.
- [ ] Validar regras de segurança (`docs/security-rules.md`) – nenhum log expõe tokens, `.env` ou certificados.
