var utils = require('./utils'),
    fs    = require('fs'),
    path  = require('path'),
    io    = require('../deps/socket.io');

var Sync = function Sync (orm, server, options) {
  var self = this;

  // Merge in the options.
  this.options = {};
  utils.merge(this.options, Sync.DEFAULT_OPTIONS);

  if (options) {
    utils.merge(this.options, options);
  }

  // Expire the cache each time a model is added.
  orm._model = orm.model;
  orm.model = function () {
    this._model.apply(this, arguments);
    self.cache = null;

    if (self.options.writePath) {
      self.writeScript();
    }
  };

  if (this.options.serveScripts) {
    var listeners = server.listeners('request');
    server.removeAllListeners('request');

    server.on('request', function (request, response) {
      if ('/' + self.options.path + '.js' !== request.url) {
        for (var i = 0, il = listeners.length; i < il; i++) {
          listeners[i].call(server, request, response);
        }
        return;
      }

      // Intercept the request.
      var scripts = self.generateScripts();

      response.writeHead(200, {
        'Content-Type':   'application/javascript',
        'Content-Length': scripts.length
      });

      response.end(scripts);
    });
  }

  this.cache = null;

  this.orm = orm;

  // Start socket.io
  this.io = io.listen(server, {
    resource: 'orm'
  });

  // Fill the cache.
  this.generateScripts();

  if (this.options.writePath) {
    this.writeScript();
  }
};

// Our main API.
// We get handed a orm instance, and a HTTP server.
exports.sync = function (orm, server, options) {
  return new Sync(orm, server, options);
};

// JSON library
Sync.JSON   = fs.readFileSync(path.join(__dirname, 'json.js')).toString();
// Client library.
Sync.CLIENT = fs.readFileSync(path.join(__dirname, 'client.js')).toString();

// Our default options.
Sync.DEFAULT_OPTIONS = {
  // Automatically server scripts on `path.js`?
  serveScripts: true,
  // Write scripts to the file system? Either set to `false` or
  // a path name.
  writePath:    false,
  // Resource path for clients.
  path:         'orm',
  // The global variable to attach ourself to.
  global:       'orm',
  // Blacklist - for ignore property types, validations and models.
  blacklist:    {
    models:         [],
    validations:    ['email'],
    property_types: ['binary']
  }
};

// We use this for injecting functions.
// 1319913 15 1337
Sync.UNIQUE = 1319913151337;

Sync.prototype.writeScript = function (path, callback) {
  path || (path = this.options.writePath);
  return fs.writeFile(path, this.generateScripts(), callback);
};

// Make the script files from the ORM instance.
// We use various bits and pieces such as `toString()`
// and `JSON.stringify` to extract what we need.
Sync.prototype.generateScripts = function () {
  if (this.cache) {
    return this.cache;
  }

  var model_name, model, obj, props, prop, value,
      attrs, attr, model_code, model_ctor,
      to_string = [],
      code      = Sync.JSON + '\n\nvar ' + this.options.global + ' = this.' + this.options.global + ' = {};\n\n',
      keys      = Object.keys(this.orm.validation_types);

  // Insert the validations
  for (var i = 0, il = keys.length; i < il; i++) {
    key = keys[i];

    // Blacklisted?
    if (-1 !== this.options.blacklist.validations.indexOf(key)) {
      continue;
    }

    value = this.orm.validation_types[key];

    // Is is async?
    if (4 > value.length) {
      value = Sync.UNIQUE + (to_string.push(value) - 1);
    } else {
      value = true;
    }

    code += this.options.global + '.validation_types["' + key + '"] = ' +
            value + ';\n\n';
  }

  // Insert the property types
  keys = Object.keys(this.orm.property_types);
  for (i = 0, il = keys.length; i < il; i++) {
    key = keys[i];

    // Blacklisted?
    if (-1 !== this.options.blacklist.property_types.indexOf(key)) {
      continue;
    }

    value = this.orm.property_types[key];

    // Is is async?
    value = Sync.UNIQUE + (to_string.push(value.out) - 1);

    code += this.options.global + '.property_types["' + key + '"] = ' +
            JSON.stringify(value) + ';\n\n';
  }

  // Loop over every model, and turn it into valid browser code.
  keys = Object.keys(this.orm.models);

  for (i = 0, il = keys.length; i < il; i++) {
    model_name       = keys[i];
    model            = this.orm.definitions[model_name];
    model_ctor       = this.orm.models[model_name];
    model.properties = model_ctor.prototype.properties;

    // Blacklisted?
    if (~this.options.blacklist.models.indexOf(model_name) ||
        ~this.options.blacklist.models.indexOf(model.type)) {
      continue;
    }

    obj = {};

    // Declaration.
    model_code = this.options.global + '.models["' + model_name + '"] = ';

    // Contruct the code.
    props = Object.keys(model);

    // Associations?
    if (model_ctor.prototype.associations) {
      obj.associations = model_ctor.prototype.associations;
    }

    // Iterate over the properties, add them according to their type.
    for (var j = 0, jl = props.length; j < jl; j++) {
      prop  = props[j];
      value = model[prop];

      // Ignore secret properties etc.
      if ('properties' === prop) {
        obj.properties = {};

        attrs = Object.keys(model.properties);
        for (var k = 0, kl = attrs.length; k < kl; k++) {
          attr = attrs[k];

          if (!model.properties[attr].secret) {
            obj.properties[attr] = model.properties[attr];
          }
        }
      } else if ('function' === typeof value) {
        obj[prop] = Sync.UNIQUE + (to_string.push(value) - 1);
      } else {
        obj[prop] = value;
      }
    }

    model_code += JSON.stringify(obj, null, '  ');

    code += model_code + ';\n\n';
  }

  // Replace uniques.
  for (i = 0, il = to_string.length; i < il; i++) {
    code = code.replace(Sync.UNIQUE + i, to_string[i].toString());
  }

  code += Sync.CLIENT.replace(/\{\{G\}\}/g, this.options.global);

  // Add some model constants.
  code += '\n' + this.options.global + '.Model.ASSOC_MANY = ' + this.orm.Model.ASSOC_MANY + ';';
  code += '\n' + this.options.global + '.Model.ASSOC_ONE = ' + this.orm.Model.ASSOC_ONE + ';';
  code += '\n' + this.options.global + '.Model.ASSOC_BELONG = ' + this.orm.Model.ASSOC_BELONG + ';';
  code += '\n' + this.options.global + '.Model.ASSOC_MANY_MANY = ' + this.orm.Model.ASSOC_MANY_MANY + ';\n';

  // Add some util methods.
  // Camels!
  code += '\n' + this.options.global + '.utils.camelCase = ' +
          this.orm.utils.camelCase.toString() + ';';

  this.cache = code;

  return code;
};
