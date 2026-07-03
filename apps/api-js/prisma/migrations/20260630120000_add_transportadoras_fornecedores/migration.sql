-- CreateTable
CREATE TABLE "transportadoras" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "tipo_pessoa" VARCHAR(2) NOT NULL,
    "nome" VARCHAR(255),
    "razao_social" VARCHAR(255),
    "nome_fantasia" VARCHAR(255),
    "cpf" VARCHAR(11),
    "cnpj" VARCHAR(14),
    "inscricao_estadual" VARCHAR(40),
    "inscricao_municipal" VARCHAR(40),
    "regime_tributario" VARCHAR(60),
    "crt" VARCHAR(2),
    "indicador_ie" VARCHAR(2),
    "tipo_contribuinte" VARCHAR(60),
    "contribuinte_icms" BOOLEAN,
    "antt" VARCHAR(20),
    "rntrc" VARCHAR(20),
    "tipo_transportadora" VARCHAR(40),
    "placa_veiculo" VARCHAR(10),
    "uf_placa" CHAR(2),
    "tipo_veiculo" VARCHAR(40),
    "modalidade_frete" VARCHAR(2),
    "permite_coleta" BOOLEAN DEFAULT true,
    "permite_entrega" BOOLEAN DEFAULT true,
    "carga_perigosa" BOOLEAN DEFAULT false,
    "tem_seguro" BOOLEAN DEFAULT false,
    "apolice_seguro" VARCHAR(40),
    "cep" VARCHAR(8),
    "logradouro" VARCHAR(255),
    "numero" VARCHAR(20),
    "complemento" VARCHAR(255),
    "bairro" VARCHAR(100),
    "municipio" VARCHAR(120),
    "uf" CHAR(2),
    "codigo_ibge" VARCHAR(20),
    "codigo_uf_ibge" VARCHAR(2),
    "pais" VARCHAR(80),
    "email" VARCHAR(255),
    "telefone" VARCHAR(20),
    "whatsapp" VARCHAR(20),
    "observacoes" TEXT,
    "fonte_dados" VARCHAR(100),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dados_originais_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transportadoras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transportadoras_company_id_idx" ON "transportadoras"("company_id");
CREATE INDEX "transportadoras_cnpj_idx" ON "transportadoras"("cnpj");
CREATE INDEX "transportadoras_ativo_idx" ON "transportadoras"("ativo");

-- AddForeignKey
ALTER TABLE "transportadoras" ADD CONSTRAINT "transportadoras_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "tipo_pessoa" VARCHAR(2) NOT NULL,
    "nome" VARCHAR(255),
    "razao_social" VARCHAR(255),
    "nome_fantasia" VARCHAR(255),
    "cpf" VARCHAR(11),
    "cnpj" VARCHAR(14),
    "inscricao_estadual" VARCHAR(40),
    "inscricao_municipal" VARCHAR(40),
    "regime_tributario" VARCHAR(60),
    "crt" VARCHAR(2),
    "indicador_ie" VARCHAR(2),
    "tipo_contribuinte" VARCHAR(60),
    "contribuinte_icms" BOOLEAN,
    "cnae" VARCHAR(20),
    "atividade_economica" VARCHAR(255),
    "natureza_juridica" VARCHAR(100),
    "situacao_cadastral" VARCHAR(100),
    "porte" VARCHAR(60),
    "optante_simples" BOOLEAN,
    "mei" BOOLEAN,
    "tipo_fornecedor" VARCHAR(40),
    "categoria" VARCHAR(60),
    "condicao_pagamento" VARCHAR(40),
    "prazo_medio_dias" SMALLINT,
    "limite_credito" DECIMAL(15,2),
    "banco" VARCHAR(60),
    "agencia" VARCHAR(20),
    "conta_bancaria" VARCHAR(30),
    "chave_pix" VARCHAR(80),
    "responsavel_comercial" VARCHAR(255),
    "email_fiscal" VARCHAR(255),
    "email_financeiro" VARCHAR(255),
    "retem_impostos" BOOLEAN DEFAULT false,
    "recorrente" BOOLEAN DEFAULT false,
    "emite_nfe" BOOLEAN DEFAULT false,
    "emite_nfse" BOOLEAN DEFAULT false,
    "exige_pedido_compra" BOOLEAN DEFAULT false,
    "cep" VARCHAR(8),
    "logradouro" VARCHAR(255),
    "numero" VARCHAR(20),
    "complemento" VARCHAR(255),
    "bairro" VARCHAR(100),
    "municipio" VARCHAR(120),
    "uf" CHAR(2),
    "codigo_ibge" VARCHAR(20),
    "codigo_uf_ibge" VARCHAR(2),
    "pais" VARCHAR(80),
    "email" VARCHAR(255),
    "telefone" VARCHAR(20),
    "whatsapp" VARCHAR(20),
    "observacoes" TEXT,
    "fonte_dados" VARCHAR(100),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dados_originais_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fornecedores_company_id_idx" ON "fornecedores"("company_id");
CREATE INDEX "fornecedores_cnpj_idx" ON "fornecedores"("cnpj");
CREATE INDEX "fornecedores_ativo_idx" ON "fornecedores"("ativo");

-- AddForeignKey
ALTER TABLE "fornecedores" ADD CONSTRAINT "fornecedores_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
