const NCM_CHAPTERS = {
  "01": "Animais vivos",
  "02": "Carnes e miudezas comestíveis",
  "03": "Peixes e crustáceos",
  "04": "Leite e laticínios; ovos; mel",
  "05": "Produtos de origem animal",
  "06": "Plantas vivas e produtos de floricultura",
  "07": "Produtos hortícolas, plantas raízes e tubérculos",
  "08": "Frutas e cascas de frutos",
  "09": "Café, chá, mate e especiarias",
  "10": "Cereais",
  "11": "Produtos da indústria de moagem; malte",
  "12": "Sementes e frutos oleaginosos; plantas industriais",
  "13": "Gomas, resinas e outros sucos vegetais",
  "14": "Materias para trançaria; outros produtos de origem vegetal",
  "15": "Gorduras, óleos e ceras animais/vegetais",
  "16": "Preparações de carne, peixes ou crustáceos",
  "17": "Açúcares e produtos de confeitaria",
  "18": "Cacau e suas preparações",
  "19": "Preparações à base de cereais, farinhas, amidos",
  "20": "Preparações de produtos hortícolas, frutas",
  "21": "Preparações alimentícias diversas",
  "22": "Bebidas, líquidos alcoólicos e vinagres",
  "23": "Resíduos das indústrias alimentares; rações",
  "24": "Tabaco e sucedâneos do tabaco",
  "25": "Sal; enxofre; terras e pedras; gessos",
  "26": "Minérios, escórias e cinzas",
  "27": "Combustíveis minerais, óleos minerais",
  "28": "Produtos químicos inorgânicos",
  "29": "Produtos químicos orgânicos",
  "30": "Produtos farmacêuticos",
  "31": "Adubos (fertilizantes)",
  "32": "Extratos tanantes; tintas e vernizes",
  "33": "Óleos essenciais; perfumaria e cosméticos",
  "34": "Sabões, agentes orgânicos, preparações para lavar",
  "35": "Matérias albuminóides; colas; enzimas",
  "36": "Pólvoras; explosivos; fósforos; pirotécnicos",
  "37": "Produtos fotográficos ou cinematográficos",
  "38": "Produtos diversos das indústrias químicas",
  "39": "Plásticos e suas obras",
  "40": "Borracha e suas obras",
  "41": "Peleteria e couros",
  "42": "Obras de couro; artigos de viagem; selaria",
  "43": "Peleteria e pele; artes artificiais",
  "44": "Madeira e suas obras; carvão vegetal",
  "45": "Cortiça e suas obras",
  "46": "Obras de debulha, palha e trançaria",
  "47": "Pastas de madeira; papel e cartão",
  "48": "Papel e cartão; obras de pasta de celulose",
  "49": "Livros, jornais, outros impressos",
  "50": "Sedas",
  "51": "Lã e pêlos finos ou grosseiros",
  "52": "Algodão",
  "53": "Outras fibras têxteis vegetais; fios de papel",
  "54": "Filamentos sintéticos ou artificiais",
  "55": "Fibras sintéticas ou artificiais",
  "56": "Guarnições de flocos; fios especiais; cordas",
  "57": "Tapetes e revestimentos para pisos",
  "58": "Tecidos especiais; tapeçarias; passamanarias",
  "59": "Tecidos impregnados, recobertos ou laminados",
  "60": "Tecidos de malha",
  "61": "Vestuário e seus acessórios, de malha",
  "62": "Vestuário e seus acessórios, exceto de malha",
  "63": "Outros artefatos têxteis confeccionados; trapos",
  "64": "Calçados, polainas e artefatos semelhantes",
  "65": "Chapéus e artefatos de uso semelhante",
  "66": "Guarda-chuvas, bengalas, chicotes",
  "67": "Penugem e plumas; flores artificiais; cabelos",
  "68": "Obras de pedra, gesso, cimento, amianto, mica",
  "69": "Produtos cerâmicos",
  "70": "Vidro e suas obras",
  "71": "Pérolas, pedras preciosas; metais preciosos; bijuterias",
  "72": "Ferros fundidos, ferro e aço",
  "73": "Obras de ferro ou aço",
  "74": "Cobre e suas obras",
  "75": "Níquel e suas obras",
  "76": "Alumínio e suas obras",
  "78": "Chumbo e suas obras",
  "79": "Zinco e suas obras",
  "80": "Estanho e suas obras",
  "81": "Outros metais comuns; cermets; obras",
  "82": "Ferramentas e artefatos de cutelaria",
  "83": "Obras diversas de metais comuns",
  "84": "Máquinas, aparelhos e material elétrico; reatores nucleares",
  "85": "Máquinas, aparelhos e material elétrico; suas partes",
  "86": "Veículos e material para vias férreas",
  "87": "Veículos automóveis; tratores; ciclos",
  "88": "Aeronaves e aparelhos espaciais",
  "89": "Embarcações e estruturas flutuantes",
  "90": "Instrumentos e aparelhos de óptica, fotografia, cinema",
  "91": "Aparelhos de relojoaria",
  "92": "Instrumentos musicais; suas partes e acessórios",
  "93": "Armas e munições; suas partes e acessórios",
  "94": "Móveis;.aviões;os de iluminação; cartazes luminosos",
  "95": "Brinquedos, jogos e artigos para divertimento",
  "96": "Obras diversas",
  "97": "Obras de arte, de coleção e antiguidades",
  "98": "Operações especiais",
  "99": "Mercadorias e produtos especiais",
};

const NCM_TABLE = [
  { ncm: "39100030", descricao: "Silicones em formas primárias", capitulo: "39", cestObrigatorio: false, st: false, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "39269090", descricao: "Outros artefatos de plástico", capitulo: "39", cestObrigatorio: false, st: false, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "84713012", descricao: "Máquinas para processamento de dados - Portáteis", capitulo: "84", cestObrigatorio: true, st: false, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: 12 },
  { ncm: "85171290", descricao: "Outros telefones para redes celulares", capitulo: "85", cestObrigatorio: true, st: false, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: 12 },
  { ncm: "87089990", descricao: "Outras partes e acessórios de veículos automóveis", capitulo: "87", cestObrigatorio: true, st: true, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: 12 },
  { ncm: "22030000", descricao: "Cervejas de malte", capitulo: "22", cestObrigatorio: true, st: true, monofasico: false, ipi: true, fcp: true, aliquotaInterestadual: null },
  { ncm: "24022000", descricao: "Cigarros contendo tabaco", capitulo: "24", cestObrigatorio: true, st: true, monofasico: false, ipi: true, fcp: true, aliquotaInterestadual: null },
  { ncm: "27101259", descricao: "Outras gasolinas", capitulo: "27", cestObrigatorio: true, st: false, monofasico: true, ipi: true, fcp: true, aliquotaInterestadual: null },
  { ncm: "27111910", descricao: "Gás natural, liquefeito (GNL)", capitulo: "27", cestObrigatorio: false, st: false, monofasico: true, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "30049099", descricao: "Outros medicamentos para uso humano", capitulo: "30", cestObrigatorio: false, st: false, monofasico: true, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "34011190", descricao: "Outros sabões e detergentes", capitulo: "34", cestObrigatorio: true, st: false, monofasico: true, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "40111000", descricao: "Pneus novos de borracha, para automóveis", capitulo: "40", cestObrigatorio: true, st: true, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "48191000", descricao: "Caixas de papel ou cartão ondulado", capitulo: "48", cestObrigatorio: false, st: false, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "48201090", descricao: "Outros papéis de uso sanitário ou doméstico", capitulo: "48", cestObrigatorio: true, st: false, monofasico: true, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "61102000", descricao: "Camisetas de algodão", capitulo: "61", cestObrigatorio: true, st: true, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "84715010", descricao: "Unidades de processamento digitais (gabinetes)", capitulo: "84", cestObrigatorio: true, st: false, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: 12 },
  { ncm: "85287290", descricao: "Outros aparelhos receptores de televisão", capitulo: "85", cestObrigatorio: true, st: true, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: 12 },
  { ncm: "94035090", descricao: "Outros móveis de madeira para quarto", capitulo: "94", cestObrigatorio: true, st: true, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "21069050", descricao: "Preparações para dietas especiais (suplementos)", capitulo: "21", cestObrigatorio: false, st: false, monofasico: true, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "02023000", descricao: "Carnes de bovino, congeladas", capitulo: "02", cestObrigatorio: false, st: false, monofasico: false, ipi: false, fcp: false, aliquotaInterestadual: 12 },
];

function getPosicao(ncm) {
  return ncm.substring(0, 4);
}

function getSubposicao(ncm) {
  return ncm.substring(0, 6);
}

function getChapterDescription(capitulo) {
  return NCM_CHAPTERS[capitulo] || `Capítulo ${capitulo}`;
}

function determineIncidence(entry) {
  const incidences = {};

  incidences.icms = entry.monofasico ? "Pode Incidir" : "Pode Incidir";
  incidences.pis = entry.monofasico ? "Monofásico" : "Pode Incidir";
  incidences.cofins = entry.monofasico ? "Monofásico" : "Pode Incidir";
  incidences.ipi = entry.ipi ? "Pode Incidir" : "Não se Aplica";
  incidences.icmsSt = entry.st ? "Pode Incidir" : "Depende da Operação";
  incidences.fcp = entry.fcp ? "Depende da Operação" : "Não se Aplica";
  incidences.difal = entry.aliquotaInterestadual != null ? "Depende da Operação" : "Não se Aplica";

  return incidences;
}

function determineRules(entry) {
  return [
    { label: "Regime Tributário", value: "Definido na emissão da NF-e" },
    { label: "UF Origem", value: "Definido na emissão da NF-e" },
    { label: "UF Destino", value: "Definido na emissão da NF-e" },
    { label: "Cliente Contribuinte", value: "Definido na emissão da NF-e" },
    { label: "Consumidor Final", value: "Definido na emissão da NF-e" },
    { label: "Finalidade da NF", value: "Definido na emissão da NF-e" },
    { label: "CFOP", value: "Definido na emissão da NF-e" },
    { label: "Alíquota Interestadual", value: entry.aliquotaInterestadual != null ? `${entry.aliquotaInterestadual}%` : "N/A" },
  ];
}

function generateAlerts(entry) {
  const alerts = [];

  if (entry.cestObrigatorio) {
    alerts.push({ type: "warning", message: "Produto pode exigir CEST — obrigatório para este NCM" });
  }
  if (entry.st) {
    alerts.push({ type: "warning", message: "Produto pode possuir Substituição Tributária conforme a UF" });
  }
  if (entry.monofasico) {
    alerts.push({ type: "info", message: "PIS/COFINS monofásico — tributação concentrada na fabricação" });
  }
  if (entry.ipi) {
    alerts.push({ type: "info", message: "IPI aplicável conforme classificação fiscal" });
  }
  if (entry.fcp) {
    alerts.push({ type: "info", message: "FCP pode incidir na operação" });
  }

  return alerts;
}

function generateRecommendations(entry, ncm) {
  const recs = [];

  recs.push({ icon: "check", message: "NCM válido" });
  recs.push({ icon: "check", message: `Descrição encontrada: ${entry.descricao}` });
  recs.push({ icon: "check", message: "Produto sujeito a ICMS" });

  if (entry.cestObrigatorio) {
    recs.push({ icon: "warning", message: "Produto pode exigir CEST" });
  }
  if (entry.st) {
    recs.push({ icon: "warning", message: "Produto pode possuir ST dependendo da UF" });
  }

  recs.push({ icon: "info", message: "Tributação final será calculada na emissão da NF-e" });

  return recs;
}

export function analyzeNcm(ncm) {
  const digits = String(ncm).replace(/\D/g, "");
  if (digits.length !== 8) {
    return { valid: false, error: "NCM deve conter 8 dígitos." };
  }

  const capitulo = digits.substring(0, 2);
  const posicao = getPosicao(digits);
  const subposicao = getSubposicao(digits);

  let entry = NCM_TABLE.find((e) => e.ncm === digits);
  let isCatalogued = true;

  if (!entry) {
    entry = {
      ncm: digits,
      descricao: `NCM ${digits} — Capítulo ${capitulo} (não catalogado localmente)`,
      capitulo,
      cestObrigatorio: false,
      st: false,
      monofasico: false,
      ipi: false,
      fcp: false,
      aliquotaInterestadual: null,
    };
    isCatalogued = false;
  }

  const classification = {
    ncm: digits,
    descricao: entry.descricao,
    capitulo,
    capituloDescricao: getChapterDescription(capitulo),
    posicao,
    subposicao,
    cestObrigatorio: entry.cestObrigatorio,
    exTipi: false,
  };

  const incidences = determineIncidence(entry);
  const rules = determineRules(entry);
  const alerts = generateAlerts(entry);
  const recommendations = generateRecommendations(entry, digits);

  return {
    valid: true,
    isCatalogued,
    classification,
    incidences,
    rules,
    alerts,
    recommendations,
    ncmLookup: {
      ncm: entry.ncm,
      descricao: entry.descricao,
      capitulo: entry.capitulo,
      cestObrigatorio: entry.cestObrigatorio,
      st: entry.st,
      monofasico: entry.monofasico,
      ipi: entry.ipi,
      fcp: entry.fcp,
      aliquotaInterestadual: entry.aliquotaInterestadual,
    },
  };
}
