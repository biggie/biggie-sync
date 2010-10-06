var utils = require('./util');

// Our main API.
// We get handed a orm instance, and a HTTP server.
exports.sync = function (orm, server, options) {
  return new Sync(orm, server, options);
};

var Sync = function Sync (orm, server, options) {
  var self = this;

  // Merge in the options.
  this.options = {};
  utils.merge(this.options, Sync.DEFAULT_OPTIONS);

  if (options) {
    utils.merge(this.options, options);
  }

  server.on('request', function (request, response) {
    console.log(request.url);

    response.writeHead(200, {
      'Content-Type': 'application/javascript'
    });

    response.end(self.generateScripts());
  });

  this.orm = orm;

  // Generate the scripts.
  console.log(this.generateScripts());
};

// Our default options.
Sync.DEFAULT_OPTIONS = {
  // Resource path for clients.
  script_path: 'orm',
  // Do we want to use the streaming functionality?
  stream:      true
};

// We use this for injecting functions.
// 1319913 15 1337
Sync.UNIQUE = 1319913151337;

// Make the script files from the ORM instance.
// We use various bits and pieces such as `toString()`
// and `JSON.stringify` to extract what we need.
Sync.prototype.generateScripts = function () {
  var model_name, model, obj, props, prop, value,
      attrs, attr, to_string, model_code, to_string,
      code      = '(function () {\n',
      keys      = Object.keys(this.orm.models);

  // Loop over every model, and turn it into valid browser code.
  for (var i = 0, il = keys.length; i < il; i++) {
    model_name = keys[i];
    model      = this.orm.definitions[model_name];
    obj        = {};

    // Declaration.
    model_code = 'orm["' + model_name + '"] = ';

    // Contruct the code.
    props = Object.keys(model);

    // Iterate over the properties, add them according to their type.
    for (var j = 0, jl = props.length; j < jl; j++) {
      prop  = props[j];
      value = model[prop];

      // Ignore secret properties etc.
      if ('properties' === prop) {
        obj.properties = {};

        attrs = Object.keys(value);
        for (var k = 0, kl = attrs.length; k < kl; k++) {
          attrs = attrs[k];

          if (!model.properties[attr].secret) {
            obj.properties[attr] = model.properties[attr];
          }
        }
      } else if ('function' === typeof value) {
        to_string || (to_string = []);
        obj[prop] = Sync.UNIQUE + (to_string.push(value) - 1);
      } else {
        obj[prop] = value;
      }
    }

    model_code += JSON.stringify(obj);

    for (j = 0, jl = to_string.length; j < jl; j++) {
      model_code = model_code.replace(Sync.UNIQUE + j, to_string[j].toString());
    }

    code += model_code + ';\n';
  }

  return code + '})();';
};
