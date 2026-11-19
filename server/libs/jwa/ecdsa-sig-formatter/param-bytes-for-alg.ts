function getParamSize(keySize: number) {
  var result = ((keySize / 8) | 0) + (keySize % 8 === 0 ? 0 : 1);
  return result;
}

var paramBytesForAlg: Record<string, number | undefined> = {
  ES256: getParamSize(256),
  ES384: getParamSize(384),
  ES512: getParamSize(521)
};

function getParamBytesForAlg(alg: string) {
  var paramBytes = paramBytesForAlg[alg];
  if (paramBytes) {
    return paramBytes;
  }

  throw new Error('Unknown algorithm "' + alg + '"');
}

export = getParamBytesForAlg;
