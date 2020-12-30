function cmpTags(a, b) {
  return cmpArrays(tagSortKey(a), tagSortKey(b));
}

exports.cmpTags = cmpTags;

function tagSortKey(s) {
  let a = s.split(/([0-9]+)/);

  // Example: '1.23rc4' -> ['1', '.', '23', 'rc', '4', ''];
  for (let i = 1; i < a.length; i += 2) {
    // Every 2nd item will be digit-only; convert it to a number.
    a[i] = +a[i];
  }

  // Don't differentiat v1.23 and 1.23 releases
  if (a[0] == '' || a[0] == 'v') a.shift()

  for (let i = 0; i < a.length; i += 3) {
    // Give any string part that starts with a word character a sorting priority
    // by inserting a `false` (< `true`) item into the key array.
    a.splice(i, 0, /^\B/.test(a[i]));
  }
  // Examples (sorted):
  //
  // * '1.2b1' -> [ false, 1, '.', false, 2, 'b', false, 1, '' ]
  // * '1.2'   -> [ false, 1, '.', false, 2, '' ]
  // * '1.2-1' -> [ false, 1, '.', false, 2, '-', false, 1, '' ]
  // * 'v1.3'  -> [ false, 1, '.', false, 3, '' ]
  // * '1.11'  -> [ false, 1, '.', false, 11, '' ]
  return a;
}

function cmpArrays(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); ++i) {
    if (a[i] !== b[i]) {
      return (a[i] > b[i] ? 1 : -1);
    }
  }
  return a.length - b.length;
}
