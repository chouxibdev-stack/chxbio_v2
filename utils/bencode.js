function decode(data, encoding = 'utf8') {
  let index = 0;

  function decodeNext() {
    if (index >= data.length) throw new Error('Unexpected end of data');

    if (data[index] === 0x69) { // i
      index++;
      const end = data.indexOf(0x65, index);
      if (end === -1) throw new Error('Invalid integer');
      const num = parseInt(data.slice(index, end).toString(), 10);
      index = end + 1;
      return num;
    }

    if (data[index] >= 0x30 && data[index] <= 0x39) { // digit = string
      const colon = data.indexOf(0x3a, index); // :
      if (colon === -1) throw new Error('Invalid string');
      const len = parseInt(data.slice(index, colon).toString(), 10);
      index = colon + 1;
      const str = data.slice(index, index + len);
      index += len;
      return encoding === 'utf8' ? str.toString('utf8') : str;
    }

    if (data[index] === 0x6c) { // l = list
      index++;
      const list = [];
      while (data[index] !== 0x65) {
        list.push(decodeNext());
      }
      index++;
      return list;
    }

    if (data[index] === 0x64) { // d = dict
      index++;
      const dict = {};
      while (data[index] !== 0x65) {
        const key = decodeNext();
        if (typeof key !== 'string') throw new Error('Dict key must be a string');
        dict[key] = decodeNext();
      }
      index++;
      return dict;
    }

    throw new Error(`Unexpected byte: ${data[index]} at position ${index}`);
  }

  return decodeNext();
}

function getFiles(torrent) {
  const info = torrent.info;
  if (!info) return [];

  if (info.files && Array.isArray(info.files)) {
    return info.files.map((f, idx) => ({
      index: idx,
      path: Array.isArray(f.path) ? f.path.join('/') : (f.path || f.name || ''),
      length: f.length || 0
    }));
  }

  if (info.name && info.length) {
    return [{ index: 0, path: info.name, length: info.length }];
  }

  return [];
}

module.exports = { decode, getFiles };
