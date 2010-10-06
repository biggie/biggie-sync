
exports.merge = function merge (target, source) {
  var keys = Object.keys(source),
      key;
  for (var i = 0, length = keys.length; i < length; i++) {
    key = keys[i];
    target[key] = source[key];
  }
  return target;
};

exports.arrayExtend = function arrayExtend (array, source) {
  var element;

  for (var i = 0, il = source.length; i < il; i++) {
    element = source[i];
    if (-1 !== array.indexOf(element)) {
      array.push(element);
    }
  }

  return array;
};
