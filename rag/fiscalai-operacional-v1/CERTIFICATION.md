# Certificação — FiscalAI Corpus Operacional v1

Data: 2026-07-29

## Estado consolidado

- Status técnico: `IMPLEMENTED_AND_CERTIFIED`
- Status operacional NVIDIA: `PAUSED_PENDING_KEY_ROTATION`
- Provedor: NVIDIA RAG Blueprint
- Coleção: `multimodal_data`
- Corpus: 6 documentos Markdown
- Chunks indexados: 19
- Perguntas de avaliação: 8
- Métricas RAGAS válidas: 24/24
- `nv_accuracy`: 0,90625
- `nv_context_relevance`: 1,00
- `nv_response_groundedness`: 1,00
- Tokens nas 8 respostas: 15.469

## Configuração certificada

- `reranker_top_k`: 3
- `vdb_top_k`: 15
- reranker habilitado
- query rewriting desabilitado
- temperatura: 0
- máximo de tokens: 400
- juiz: `nvidia/nemotron-3-super-120b-a12b`

## Validações

- integridade SHA-256 do corpus: aprovada
- ingestão idempotente: aprovada
- teste do ingestor: 3/3
- adaptador NVIDIA RAG: aprovado
- suíte unitária da API: 82/82
- lint e build da API: aprovados
- artefatos RAGAS sem `NaN`: aprovados

## Ressalva de segurança

A chave NVIDIA exposta na conversa foi removida do `.env`, o contêiner
`rag-server` foi parado e o login local em `nvcr.io` foi removido. A revogação
da credencial no portal NVIDIA ainda deve ser executada pelo titular. Uma nova
avaliação online só deve ocorrer com uma chave rotacionada, fornecida por secret
manager, sem registrá-la no Git ou na conversa.
