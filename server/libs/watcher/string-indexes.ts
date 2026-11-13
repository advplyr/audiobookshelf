/* STRING INDEXES */
function indexes(str: string, substr: string) {
  var indexes: number[] = [], rangeLength = substr.length;
  var indexFrom = 0;
  while (true) {
    var index = str.indexOf(substr, indexFrom);
    if (index === -1)
      return indexes;
    indexes.push(index);
    indexFrom = index + rangeLength;
  }
}
/* EXPORT */
const exported = Object.assign(indexes, { default: indexes });
Object.defineProperty(exported, "__esModule", { value: true });

export = exported;
