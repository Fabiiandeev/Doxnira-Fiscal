import { importCteXml } from "./document-link.service.js";

export async function importMockCte(companyId, nfeKeys = []) {
  const key = `52260612874659000142570010000${String(Date.now()).slice(-9)}1`.slice(0, 44);
  const references = nfeKeys.map((nfeKey) => `<infNFe><chave>${nfeKey}</chave></infNFe>`).join("");
  const xml = `<cteProc><CTe><infCte Id="CTe${key}"><ide><nCT>9001</nCT><serie>1</serie><dhEmi>${new Date().toISOString()}</dhEmi></ide><emit><CNPJ>07632598000188</CNPJ><xNome>Transportadora Mock Ltda.</xNome></emit><dest><CNPJ>12874659000142</CNPJ><xNome>NS Sistemas Tecnologia Ltda.</xNome></dest><vPrest><vTPrest>985.40</vTPrest></vPrest><infDoc>${references}</infDoc></infCte></CTe></cteProc>`;
  return importCteXml(companyId, xml);
}
