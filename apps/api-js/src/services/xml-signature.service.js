import { SignedXml } from "xml-crypto";

import { AppError } from "../utils/app-error.js";

export function signEventXml(xml, privateKeyPem, certificatePem) {
  try {
    const signature = new SignedXml({
      privateKey: privateKeyPem,
      publicCert: certificatePem,
    });
    signature.signatureAlgorithm =
      "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
    signature.canonicalizationAlgorithm =
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
    signature.addReference({
      xpath: "//*[local-name(.)='infEvento']",
      transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
      ],
      digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    });
    signature.computeSignature(xml, {
      location: {
        reference: "//*[local-name(.)='evento']",
        action: "append",
      },
    });
    return signature.getSignedXml();
  } catch {
    throw new AppError(
      "Falha ao assinar o evento fiscal.",
      "XML_SIGNATURE_ERROR",
      422,
    );
  }
}
