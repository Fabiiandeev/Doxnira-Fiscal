# FiscalAI — Corpus Operacional v1

Corpus controlado para validar o NVIDIA RAG do FiscalAI.

## Escopo

- comportamento operacional da validação NF-e;
- cenários de teste e protocolo de correção;
- políticas internas de segurança fiscal;
- escopo atual do CT-e de entrada;
- referências técnicas registradas no repositório.

## Limites

- não substitui legislação, tabela fiscal oficial ou revisão contábil;
- não autoriza alteração automática de alíquota, CFOP, NCM ou fundamento legal;
- referências datadas devem ser reconfirmadas antes de uso em produção;
- não contém XML real, certificado, credencial, CNPJ ou CPF de produção.

## Estrutura

- `corpus/`: documentos Markdown efetivamente ingeridos;
- `train.json`: perguntas e respostas esperadas para avaliação;
- `manifest.sha256`: integridade dos documentos do corpus.

