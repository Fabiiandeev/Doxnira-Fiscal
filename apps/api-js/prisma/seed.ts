import { createHash } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const suppliers = [
  ["07632598000188", "Atacado Cerrado Ltda.", "GO"],
  ["33014556000196", "Industria Horizonte S.A.", "SP"],
  ["60701190000104", "Distribuidora Norte Sul Ltda.", "MG"],
  ["19131243000197", "Comercial Vale Verde Ltda.", "PR"],
  ["45362571000145", "Tecnologia Prisma Comercio Ltda.", "SC"],
  ["11222333000181", "Logistica Planalto Ltda.", "DF"],
  ["27865757000102", "Alimentos Nova Safra S.A.", "BA"],
  ["02558157000162", "Materiais Goias Centro Ltda.", "GO"],
];

const statusCycle = ["AUTHORIZED", "AUTHORIZED", "AUTHORIZED", "CANCELLED", "EVENT"];
const manifestationCycle = ["PENDING", "AWARE", "CONFIRMED", "UNKNOWN", "NOT_PERFORMED"];

function accessKey(index: number, issuerCnpj: string) {
  return `52${String(2606 + (index % 6)).padStart(4, "0")}${issuerCnpj}5500100${String(100000 + index).padStart(9, "0")}1`.slice(0, 44);
}

function dateDaysAgo(days: number, hour = 10) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000 - Math.max(1, hour) * 60 * 60 * 1000 - (days * 7) % 60 * 60 * 1000);
}

async function clearDatabase() {
  await prisma.documentTagLink.deleteMany();
  await prisma.documentNote.deleteMany();
  await prisma.xmlDownloadLog.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.manifestation.deleteMany();
  await prisma.fiscalEvent.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.fiscalDocumentLink.deleteMany();
  await prisma.transportDocument.deleteMany();
  await prisma.monthlyTaxClosingItem.deleteMany();
  await prisma.monthlyTaxClosingWarning.deleteMany();
  await prisma.monthlyTaxClosing.deleteMany();
  await prisma.fiscalDocumentItem.deleteMany();
  await prisma.companyTaxSetting.deleteMany();
  await prisma.product.deleteMany();
  await prisma.client.deleteMany();
  await prisma.taxRule.deleteMany();
  await prisma.fiscalDocument.deleteMany();
  await prisma.digitalCertificate.deleteMany();
  await prisma.savedFilter.deleteMany();
  await prisma.documentTag.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await clearDatabase();

  const user = await prisma.user.create({
    data: {
      name: "Fabian",
      email: "admin@nssistemas.com.br",
      passwordHash: await bcrypt.hash("123456", 12),
      role: "OWNER",
    },
  });

  const accountant = await prisma.user.create({
    data: {
      name: "Carla Mendes",
      email: "carla@contabilidademendes.com.br",
      passwordHash: await bcrypt.hash("123456", 12),
      role: "ACCOUNTANT",
    },
  });

  const company = await prisma.company.create({
    data: {
      ownerId: user.id,
      legalName: "NS Sistemas Tecnologia Ltda.",
      tradeName: "NS Sistemas",
      cnpj: "12874659000142",
      stateRegistration: "106521670",
      uf: "GO",
      city: "Goiania",
      taxRegime: "Lucro Presumido",
      environment: "homologation",
      status: "active",
      nfeLastNsu: "000009876543127",
      nfeMaxNsu: "000009876543127",
      lastSyncAt: dateDaysAgo(0, 8),
    },
  });

  await prisma.userPreference.create({
    data: {
      userId: user.id,
      defaultCompanyId: company.id,
      theme: "light",
      accentColor: "#E8FF5A",
      tableDensity: "comfortable",
      dashboardLayout: { metrics: true, flow: true, suppliers: true, alerts: true },
    },
  });

  await prisma.companyTaxSetting.create({
    data: {
      companyId: company.id,
      taxRegime: "LUCRO_PRESUMIDO",
      calculationRegime: "COMPETENCIA",
      uf: "GO",
      stateRegistration: "106521670",
      mainCnae: "6201-5/00",
      simplesAnnex: null,
      mainActivity: "Desenvolvimento de software",
      isIcmsTaxpayer: true,
      isIpiTaxpayer: false,
      pisCofinsRegime: "CUMULATIVO",
      accumulatedRevenue: 450000,
    },
  });

  const clientsData = [
    {
      tipoPessoa: "PJ",
      razaoSocial: "Gama Tech LTDA",
      nomeFantasia: "Gama Tech",
      cnpj: "12345678000190",
      inscricaoEstadual: "123456789123",
      regimeTributario: "Lucro Presumido",
      cnae: "6201-5/00",
      atividadeEconomica: "Desenvolvimento de software",
      cep: "01311000",
      logradouro: "Av. Paulista",
      numero: "1000",
      bairro: "Bela Vista",
      municipio: "Sao Paulo",
      uf: "SP",
      email: "contato@gamatech.com",
      telefone: "11999999999",
      fonteDados: "SEED",
    },
    {
      tipoPessoa: "PJ",
      razaoSocial: "Beta Comercio S.A.",
      nomeFantasia: "Beta Comercio",
      cnpj: "98765432000110",
      inscricaoEstadual: "987654321987",
      regimeTributario: "Simples Nacional",
      cnae: "4651-0/01",
      atividadeEconomica: "Comercio de hardware",
      cep: "01305000",
      logradouro: "Rua Augusta",
      numero: "500",
      bairro: "Consolacao",
      municipio: "Sao Paulo",
      uf: "SP",
      email: "vendas@betacomercio.com",
      telefone: "11888888888",
      fonteDados: "SEED",
    },
    {
      tipoPessoa: "PJ",
      razaoSocial: "Delta Distribuidora ME",
      nomeFantasia: "Delta Dist",
      cnpj: "11222333000144",
      inscricaoEstadual: null,
      regimeTributario: "Simples Nacional",
      cnae: "4646-0/01",
      atividadeEconomica: "Distribuicao de eletronicos",
      cep: "20031000",
      logradouro: "Av. Brasil",
      numero: "2000",
      bairro: "Centro",
      municipio: "Rio de Janeiro",
      uf: "RJ",
      email: "comercial@deltadist.com",
      telefone: "21777777777",
      fonteDados: "SEED",
    },
    {
      tipoPessoa: "PF",
      nome: "Joao da Silva",
      cpf: "12345678901",
      rg: "1234567",
      cep: "74000000",
      logradouro: "Rua 10",
      numero: "150",
      bairro: "Centro",
      municipio: "Goiania",
      uf: "GO",
      email: "joao@email.com",
      telefone: "62966666666",
      fonteDados: "SEED",
    },
    {
      tipoPessoa: "PF",
      nome: "Maria Oliveira",
      cpf: "98765432100",
      rg: "7654321",
      cep: "70200000",
      logradouro: "SQS 308",
      numero: "22",
      bairro: "Asa Sul",
      municipio: "Brasilia",
      uf: "DF",
      email: "maria@email.com",
      telefone: "61955555555",
      fonteDados: "SEED",
    },
  ];

  const createdClients = [];
  for (const clientData of clientsData) {
    const client = await prisma.client.create({
      data: { ...clientData, ownerId: user.id, companyId: company.id },
    });
    createdClients.push(client);
  }

  const productsData = [
    { name: "Smartphone Samsung Galaxy S24", code: "SM-S24-128", ncm: "85171200", cest: "28038000", unit: "UN", price: 2499.00, stock: 45, active: true },
    { name: "Notebook Dell Inspiron 15", code: "NB-DELL-I15", ncm: "84713012", cest: "28038000", unit: "UN", price: 3299.00, stock: 12, active: true },
    { name: "Capa Protetora Transparente", code: "CAPA-S24-TR", ncm: "39269090", cest: null, unit: "UN", price: 29.90, stock: 200, active: true },
    { name: "Carregador USB-C 65W", code: "CARG-USBC-65", ncm: "85044010", cest: null, unit: "UN", price: 89.90, stock: 50, active: true },
    { name: "Mouse Logitech MX Master 3", code: "MOUSE-MXM3", ncm: "84716053", cest: null, unit: "UN", price: 549.00, stock: 30, active: true },
    { name: "Monitor LG UltraWide 34\"", code: "MON-LG-UW34", ncm: "85285200", cest: "28038000", unit: "UN", price: 2899.00, stock: 8, active: true },
    { name: "Teclado Mecanico Redragon", code: "TEC-RED-K1", ncm: "84716053", cest: null, unit: "UN", price: 249.90, stock: 60, active: true },
    { name: "SSD Kingston 480GB", code: "SSD-KST-480", ncm: "84717010", cest: null, unit: "UN", price: 179.90, stock: 100, active: true },
    { name: "Webcam Logitech C920", code: "CAM-LOG-C920", ncm: "85258019", cest: null, unit: "UN", price: 399.00, stock: 15, active: false },
    { name: "Hub USB-C 7 portas", code: "HUB-USBC-7P", ncm: "84719012", cest: null, unit: "UN", price: 129.90, stock: 40, active: true },
  ];

  for (const productData of productsData) {
    await prisma.product.create({
      data: { ...productData, companyId: company.id },
    });
  }

  const documents = [];
  for (let index = 0; index < 80; index += 1) {
    const [issuerCnpj, issuerName, uf] = suppliers[index % suppliers.length];
    const key = accessKey(index, issuerCnpj);
    const amount = Number((620 + ((index * 913.73) % 64_000)).toFixed(2));
    const status = statusCycle[index % statusCycle.length];
    const invoiceNumber = String(10800 + index);
    const xml = `<nfeProc versao="4.00"><NFe><infNFe Id="NFe${key}"><ide><cUF>52</cUF><mod>55</mod><serie>1</serie><nNF>${invoiceNumber}</nNF></ide><emit><CNPJ>${issuerCnpj}</CNPJ><xNome>${issuerName}</xNome></emit><dest><CNPJ>${company.cnpj}</CNPJ><xNome>${company.legalName}</xNome></dest><det nItem="1"><prod><cProd>ITEM-${index + 1}</cProd><xProd>Produto fiscal ${index + 1}</xProd><qCom>${(index % 5) + 1}</qCom><vUnCom>${amount.toFixed(2)}</vUnCom></prod></det><total><ICMSTot><vNF>${amount.toFixed(2)}</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><nProt>152260000${String(index).padStart(6, "0")}</nProt></infProt></protNFe></nfeProc>`;
    let documentType = index % 11 === 0 ? "CTE" : "NFE";
    let operationDirection: string | null = null;
    let companyRole: string | null = null;
    if (index === 0) {
      documentType = "NFE"; operationDirection = "INBOUND"; companyRole = "RECIPIENT";
    } else if (index === 1) {
      documentType = "NFE"; operationDirection = "OUTBOUND"; companyRole = "ISSUER";
    } else if (index === 2) {
      documentType = "CTE"; operationDirection = "TRANSPORT_INBOUND"; companyRole = "RECIPIENT";
    } else if (index === 3) {
      documentType = "CTE"; operationDirection = "TRANSPORT_OUTBOUND"; companyRole = "ISSUER";
    } else {
      documentType = index % 11 === 0 ? "CTE" : "NFE";
      operationDirection = index % 2 === 0 ? "INBOUND" : "OUTBOUND";
      companyRole = operationDirection === "INBOUND" ? "RECIPIENT" : "ISSUER";
    }

    documents.push({
      companyId: company.id,
      documentType,
      invoiceNumber,
      series: String((index % 3) + 1),
      model: documentType === "CTE" ? "57" : "55",
      accessKey: key,
      nsu: String(9_876_543_048 + index).padStart(15, "0"),
      schemaName: index % 4 === 0 ? "resNFe_v1.01.xsd" : "procNFe_v4.00.xsd",
      status,
      protocol: `152260000${String(index).padStart(6, "0")}`,
      manifestationStatus: manifestationCycle[index % manifestationCycle.length],
      issuerCnpj,
      issuerName,
      recipientCnpj: company.cnpj,
      recipientName: company.legalName,
      uf,
      cfop: index % 3 === 0 ? "6102" : "5102",
      emissionDate: dateDaysAgo(index % 170, 8 + (index % 10)),
      authorizationDate: dateDaysAgo(index % 170, 9 + (index % 9)),
      totalAmount: amount,
      productsAmount: amount,
      icmsAmount: Number((amount * 0.18).toFixed(2)),
      pisAmount: Number((amount * 0.0165).toFixed(2)),
      cofinsAmount: Number((amount * 0.076).toFixed(2)),
      icmsBase: Number((amount * 0.18).toFixed(2)),
      taxAmount: Number((amount * 0.2725).toFixed(2)),
      xmlStorageKey: `seed/nfe/${key}.xml`,
      xmlHashSha256: createHash("sha256").update(xml).digest("hex"),
      source: "SEED",
      rawXml: xml,
      products: [{ code: `ITEM-${index + 1}`, description: `Produto fiscal ${index + 1}`, quantity: (index % 5) + 1, unitValue: amount / ((index % 5) + 1) }],
      taxes: { icms: Number((amount * 0.18).toFixed(2)), pis: Number((amount * 0.0165).toFixed(2)), cofins: Number((amount * 0.076).toFixed(2)) },
      isSummary: index % 6 === 0,
      isCancelled: status === "CANCELLED",
      isNewSupplier: index < 8,
      operationDirection,
      companyRole,
    });
  }

  await prisma.fiscalDocument.createMany({ data: documents });
  const createdDocuments = await prisma.fiscalDocument.findMany({
    where: { companyId: company.id },
    orderBy: { emissionDate: "desc" },
  });

  const documentItems = createdDocuments.slice(0, 20).map((doc, index) => ({
    documentId: doc.id,
    companyId: company.id,
    itemNumber: 1,
    productCode: `ITEM-${index + 1}`,
    description: `Produto fiscal ${index + 1}`,
    ncm: index % 2 === 0 ? "85171200" : "84713012",
    cfop: index % 3 === 0 ? "6102" : "5102",
    cst: index % 2 === 0 ? "00" : "60",
    quantity: (index % 5) + 1,
    unit: "UN",
    unitValue: Number(doc.totalAmount) / ((index % 5) + 1),
    totalValue: Number(doc.totalAmount),
    icmsBase: Number(doc.totalAmount) * 0.18,
    icmsRate: 18,
    icmsAmount: Number(doc.totalAmount) * 0.18,
  }));

  if (documentItems.length > 0) {
    await prisma.fiscalDocumentItem.createMany({ data: documentItems });
  }

  await prisma.fiscalEvent.createMany({
    data: createdDocuments.slice(0, 10).map((doc, index) => ({
      companyId: company.id,
      fiscalDocumentId: doc.id,
      accessKey: doc.accessKey,
      eventType: index % 3 === 0 ? "CANCELAMENTO" : "AUTORIZACAO",
      eventSequence: 1,
      protocol: `EVENTO-${String(index + 1).padStart(5, "0")}`,
      eventDate: dateDaysAgo(index, 12),
      nsu: doc.nsu,
      schemaName: "procEventoNFe_v1.00.xsd",
      xmlStorageKey: `seed/events/${doc.accessKey}-${index}.xml`,
      xmlHashSha256: createHash("sha256").update(`event-${doc.id}`).digest("hex"),
    })),
  });

  await prisma.manifestation.createMany({
    data: createdDocuments.slice(10, 15).map((doc, index) => ({
      companyId: company.id,
      fiscalDocumentId: doc.id,
      accessKey: doc.accessKey,
      eventType: manifestationCycle[index],
      justification: manifestationCycle[index] === "NOT_PERFORMED" ? "Operacao comercial nao reconhecida pela empresa destinataria." : null,
      protocol: `MANIFEST-${String(index + 1).padStart(5, "0")}`,
      status: "REGISTERED_MOCK",
      responseStorageKey: `seed/manifestations/${doc.accessKey}-${index}.xml`,
      createdAt: dateDaysAgo(index + 1, 14),
    })),
  });

  const alertTypes = [
    ["certificate", "high", "Certificado digital nao cadastrado"],
    ["cancelled", "high", "NF-e cancelada apos entrada"],
    ["summary", "medium", "XML completo pendente"],
    ["new_supplier", "low", "Novo fornecedor identificado"],
    ["sync", "medium", "Janela de sincronizacao disponivel"],
  ];
  await prisma.alert.createMany({
    data: Array.from({ length: 10 }, (_, index) => {
      const [type, severity, title] = alertTypes[index % alertTypes.length];
      return {
        companyId: company.id,
        fiscalDocumentId: type === "certificate" || type === "sync" ? null : createdDocuments[index].id,
        type,
        severity,
        title,
        message: type === "certificate" ? "Envie um certificado A1 para habilitar a sincronizacao simulada e preparar a integracao fiscal." : `Verifique o item fiscal relacionado ao alerta ${index + 1}.`,
        status: index < 6 ? "open" : index < 8 ? "unread" : "resolved",
        readAt: index < 6 || index >= 8 ? dateDaysAgo(index, 15) : null,
        resolvedAt: index >= 8 ? dateDaysAgo(index - 7, 16) : null,
        createdAt: dateDaysAgo(index, 7 + index),
      };
    }),
  });

  await prisma.syncLog.createMany({
    data: Array.from({ length: 8 }, (_, index) => {
      const startedAt = dateDaysAgo(index, 8);
      const finishedAt = new Date(startedAt.getTime() + (12 + index * 4) * 1000);
      const status = index === 5 ? "WARNING" : index === 7 ? "ERROR" : "SUCCESS";
      const cstat = index === 5 ? "137" : index === 7 ? "656" : "138";
      return {
        companyId: company.id,
        service: "NFeDistribuicaoDFe",
        requestType: "distNSU",
        requestNsu: String(9_876_543_100 + index).padStart(15, "0"),
        responseUltNsu: String(9_876_543_108 + index).padStart(15, "0"),
        responseMaxNsu: "000009876543127",
        cstat,
        xmotivo: cstat === "138" ? "Documentos localizados" : cstat === "137" ? "Nenhum documento localizado" : "Consumo indevido - aguarde a janela de consulta",
        documentsCount: cstat === "138" ? 6 + index : 0,
        documentsReceived: cstat === "138" ? 6 + index : 0,
        documentsSaved: cstat === "138" ? 6 + index : 0,
        mode: "mock",
        environment: company.environment,
        status,
        startedAt,
        finishedAt,
        errorMessage: status === "ERROR" ? "Janela minima de consulta ainda nao cumprida." : null,
      };
    }),
  });

  await prisma.auditLog.createMany({
    data: [
      { companyId: company.id, userId: user.id, action: "seed.created", entityType: "Company", entityId: company.id, metadata: { documents: 80, alerts: 10, syncLogs: 8, clients: 5, products: 10 } },
      { companyId: company.id, userId: user.id, action: "auth.login", metadata: { source: "seed" } },
      { companyId: company.id, userId: accountant.id, action: "accountant.registered", entityType: "User", entityId: accountant.id, metadata: { role: "ACCOUNTANT" } },
    ],
  });

  const result = {
    user: { email: user.email, password: "123456" },
    accountant: { email: accountant.email, password: "123456" },
    companyId: company.id,
    clients: createdClients.length,
    products: productsData.length,
    documents: createdDocuments.length,
  };

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main()
  .catch((error) => {
    process.stderr.write("Seed failed: " + error.message + "\n");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
