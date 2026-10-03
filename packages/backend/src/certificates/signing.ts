import {
  err,
  ok,
  readErrorMessage,
  type Result,
  type SignatureAlgorithm,
} from "shared";

import { forge } from "../runtime/forge";

import { DIGESTS, readCertificate, readPrivateKey } from "./generate";

export const signBytes = (input: {
  privateKeyPem: string;
  contentBase64: string;
  algorithm: SignatureAlgorithm;
}): Result<string> => {
  const key = readPrivateKey(input.privateKeyPem);
  if (key.kind === "Failed") {
    return err(`The private key could not be read: ${key.failure.message}`);
  }

  try {
    const digest = DIGESTS[input.algorithm]();
    digest.update(forge.util.decode64(input.contentBase64), "raw");

    return ok(forge.util.encode64(key.value.sign(digest)));
  } catch (error) {
    return err(readErrorMessage(error));
  }
};

export const verifyBytes = (input: {
  certificatePem: string;
  contentBase64: string;
  signatureBase64: string;
  algorithm: SignatureAlgorithm;
}): Result<boolean> => {
  const certificate = readCertificate(input.certificatePem);
  if (certificate.kind === "Failed") {
    return err(
      `The certificate could not be read: ${certificate.failure.message}`,
    );
  }

  try {
    const digest = DIGESTS[input.algorithm]();
    digest.update(forge.util.decode64(input.contentBase64), "raw");

    const key = certificate.value.publicKey as forge.pki.rsa.PublicKey;
    return ok(
      key.verify(
        digest.digest().bytes(),
        forge.util.decode64(input.signatureBase64),
      ),
    );
  } catch {
    return ok(false);
  }
};
