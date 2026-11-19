import utilities from './utilities';

type Fields = Record<string, unknown>;
const { isSafeFromPollution } = utilities;

function setField(target: unknown, key: string, value: unknown) {
  // The original non-strict module silently ignored writes to primitive or read-only values.
  if (target != null) {
    Reflect.set(Object(target) as object, key, value, target);
  } else {
    const fields = target as unknown as Fields;
    fields[key] = value;
  }
}

export = function(input: unknown){
  const data = input as (Fields & { length?: number }) | null | undefined;
  if (!data || data.length! < 1) return Object.create(null) as Fields;

  let d = Object.create(null) as Fields,
    keys = Object.keys(data);

  for (let i = 0; i < keys.length; i++) {
    let key = keys[i],
      value = data[key],
      current = d,
      keyParts = key
        .replace(new RegExp(/\[/g), '.')
        .replace(new RegExp(/\]/g), '')
        .split('.');

    for (let index = 0; index < keyParts.length; index++){
      let k = keyParts[index];

      // Ensure we don't allow prototype pollution
      if (!isSafeFromPollution(current, k)) {
        continue;
      }

      if (index >= keyParts.length - 1){
        setField(current, k, value);
      } else {
        if (!current[k]) setField(current, k, !isNaN(keyParts[index + 1] as unknown as number) ? [] : Object.create(null) as Fields);
        current = current[k] as Fields;
      }
    }
  }
  return d;
};
