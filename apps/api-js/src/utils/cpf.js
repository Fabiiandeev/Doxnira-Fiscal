// Remove tudo que não é número do CPF
// Entrada: "123.456.789-10" ou "12345678910"
// Saída: "12345678910"
export function normalizeCpf(value = "") {
  // String() converte para string se não for
  // .replace(/\D/g, "") remove todos os caracteres que NÃO são dígitos
  // /\D/ = regex que significa "tudo que não é dígito"
  // g = "global" (substitui todas as ocorrências)
  return String(value).replace(/\D/g, "");
}

// Valida se um CPF é válido
// Entrada: "123.456.789-10" ou "12345678910"
// Saída: true ou false
export function isValidCpf(value) {
  // Normaliza o CPF removendo caracteres especiais
  const cpf = normalizeCpf(value);

  // CPF válido SEMPRE tem 11 dígitos
  // Se não tiver 11 dígitos, é inválido
  if (cpf.length !== 11) return false;

  // Verifica se todos os dígitos são iguais (ex: "11111111111", "00000000000")
  // /^(\d)\1{10}$/ significa:
  //   ^     = início da string
  //   (\d)  = capture um dígito (representado por \1)
  //   \1{10}= repete esse mesmo dígito 10 vezes
  //   $     = fim da string
  // Se passar nesse teste, é inválido
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Função para calcular cada dígito verificador
  // base = primeiros 9 dígitos do CPF
  // factor = começa em 10 (primeira vez) ou 11 (segunda vez)
  const calcDigit = (base, factor) => {
    // Multiplica cada dígito pelo fator decrescente
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * (factor - i);
    }
    // Resto da divisão por 11
    const remainder = sum % 11;
    // Se resto < 2, dígito verificador é 0, senão é 11 - resto
    return remainder < 2 ? 0 : 11 - remainder;
  };

  // Calcula primeiro dígito verificador (10º dígito)
  // Usa os 9 primeiros dígitos e começa o fator em 10
  const first = calcDigit(cpf.slice(0, 9), 10);

  // Calcula segundo dígito verificador (11º dígito)
  // Usa os 9 primeiros dígitos + o primeiro verificador
  // e começa o fator em 11
  const second = calcDigit(cpf.slice(0, 9) + first, 11);

  // Compara os dígitos calculados com os últimos 2 dígitos do CPF
  // Se forem iguais, o CPF é válido
  return cpf.endsWith(`${first}${second}`);
}
