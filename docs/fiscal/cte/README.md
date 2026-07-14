# CT-e de Entrada

O módulo trata exclusivamente CT-e modelo 57 recebido pela empresa. Não emite CT-e nem chama a SEFAZ nesta etapa.

Fluxo alvo: importar XML autorizado, validar localmente, identificar a transportadora, vincular NF-e da mesma empresa, calcular e confirmar rateio, aplicar somente custo (sem quantidade de estoque), gerar financeiro e preparar escrituração.

O XML é entrada não confiável: o parser não resolve entidades externas, o upload permanece limitado a 8 MB e XML sem schema oficial versionado não pode atingir o estado validado.

## Base atual

Já existem `CteEntry`, `CteEntryNfeLink` e `CteEntryAuditLog`, além das rotas de listagem, sincronização preparada e vínculo manual. Ainda faltam importação XML dedicada, parser/validador CT-e, rateio, custo, financeiro, escrituração, eventos e telas próprias.
