// The biggie-sync browser library.

// We don't need to wrap, as we are already name-spaced to {{G}}.
// This should mean slightly leaner performance on most browsers.
{{G}}.init = function () {
  var model, Ctor,
      models = this.models;

  // For each model, add the mappings and the helper methods.
  // Anything async gets mapped to the server.
  for (model in models) {
    if (models.hasOwnProperty(model)) {
      Ctor = this._createModel(models[model]);

      // Mappings.
      this.plurals[Ctor.plural]   = Ctor;
      this.model_names[Ctor.type] = Ctor;
      this.models[model]          = Ctor;
    }
  }

  this.io.connect();

  this.io.on('message', function (data) {
    {{G}}._handleMessage(data);
  });
};

{{G}}.io = new io.Socket(location.hostname, {
  resource: 'orm'
});

// For getting models only.
{{G}}.model = function (name) {
  return this.models[name];
};

// Mappings for plurals.
{{G}}.plurals = {};

// Mappings for types.
{{G}}.model_names = {};

// Create a constructor from a definition.
{{G}}._createModel = function (definition) {
  var model = function (attributes) {
    {{G}}.Model.call(this, attributes);
  };

  this.utils.extend(model, this.Model);

  var proto   = model.prototype,
      proxies = ['save', 'remove'],
      key, value;

  proto.properties || (proto.properties = {});

  for (key in definition) {
    if (definition.hasOwnProperty(key)) {
      value = definition[key];

      // Is is a definition, or custom property?
      if (this.utils.validateProperty(props[key])) {
        this._addModelProperty(model, key, props[key]);
      } else {
        if ('indexes' === key && proto.indexes) {
          proto.indexes.push.apply(proto.indexes, props[key]);
        } else {
          // Custom property. Make it happen.
          proto[key] = props[key];
        }
      }
    }
  }

  // Views
  for (var i = 0, il = definition.views.length; i < il; i++) {
    proxies.push('get' + this.utils.camelCase(definition.views[i], true));
  }

  // TODO: Add association methods.

  // TODO: Add proxy methods
};

{{G}}._addModelProperty = function (model, key, prop) {
  model.prototype.properties[key] = prop;

  // If unique, make sure we have a index for the key.
  if (prop.unique) {
    model.prototype.indexes || (model.prototype.indexes = []);
    if (-1 === this.utils.indexOf(model.prototype.indexes, key)) {
      model.prototype.indexes.push(key);
    }
  }

  // Add a get/set for convenience, if we are allowed.
  if (model.prototype[key] !== undefined) return;

  if (Object.defineProperty) {
    Object.defineProperty(model.prototype, key, {
      get: function () {
        return this.get(key);
      },
      set: function (value) {
        this.set(key, value);
      },
      enumerable: true
    });
  }
};

// For the server requests.
{{G}}._id    = 0;
{{G}}._queue = {};
{{G}}._request = function (args, data, callback) {
  var id = this._id++;
  args.unshift(id);
  args  = args.join(':');
  args += '|' + data.toJSON();
  this._queue[id] = callback;

  this.io.write(args);
};

// For incoming traffic.
{{G}}._handleMessage = function (data) {
  var id = 0,
      index = data.indexOf('|');

  args = data.slice(0, index).split(':');
  data = data.slice(index + 1, data.length);

  if (id = +args[0]) {
    this._queue[id](data);
    this._queue[id] = undefined;
  } else {
    this.emitter.emit(args[0] + ':' + args[1] + ':' + args[2], data);
  }
};

// Model.
{{G}}.Model = function (attributes) {
  // Setup instance variables
  this.attributes = {};
  this.diff       = {
    attributes:   [],
    associations: {}
  };
  this.errors     =  {};
  this.previous   =  {
    attributes: {},
  };

  // Valid argument?
  attributes || (attributes = {});

  // Get the keys
  var key,
      result;

  for (key in attributes) {
    if (attributes.hasOwnProperty(key)) {
      this.set(key, attributes[key]);
    }
  }

  // Make sure we return ourself
  return this;
};

{{G}}.Model.new = function (attributes) {
  return new this(attributes);
};

{{G}}.Model.proxyMethod = function (method, callback) {
  return {{G}}._request([method], this, callback);
};

// Standard properties
{{G}}.Model.prototype.is_new     = true;
{{G}}.Model.prototype.removed    = false;
{{G}}.Model.prototype.has_errors = false;
{{G}}.Model.prototype.changed    = false;

// Set a attribute
{{G}}.Model.prototype.set = function set (name, value, silent) {
  // Return early if there was no change.
  if (this[name] === value) return this;

  // Are we a valid attribute?
  if (this.properties[name]) {
    this.attributes[name] = value;

    // Silent and deadly huh? Stealthy...
    if (silent) {
      this.previous.attributes[name] = value;
    } else {
      this.changed = true;
      this.diff.attributes.push(name);
    }
  }

  return this;
};

// Get a attribute/property
{{G}}.Model.prototype.get = function get (name, def) {
  return this.properties[name] ?
              this.attributes[name] !== undefined ? this.attributes[name] : def :
              def;
};

// Update serveral properties at once.
{{G}}.Model.prototype.update = function (attributes) {
  var key;

  // For each attribute key, call set()
  for (key in attributes) {
    if (attributes.hasOwnProperty(key)) {
      this.set(key, attributes[key]);
    }
  }

  // Return `this` so we can chain.
  return this;
};

{{G}}.Model.prototype.toObject = function () {
  var key,
      ret = {};

  ret.id         = this.id || null;
  ret.type       = this.type;
  ret.plural     = this.plural;
  ret.attributes = {};

  for (var i = 0, il = this.diff.attributes.length; i < il; i++) {
    key = this.diff.attributes[i];
    ret.attributes[key] = this.attributes[key];
  }

  // Associations.
  if (this.associations) {
    for (key in this.diff.associations) {
      if (this.diff.associations.hasOwnProperty(key)) {
        ret.associations || (ret.associations = {});
        ret.associations = this.diff.associations[key].toObject();
      }
    }
  }

  return ret;
};

{{G}}.Model.prototype.toJSON = function () {
  return JSON.stringify(this.toObject());
};

// Collection.
{{G}}.Collection = function (array) {
  if (array) this.push.apply(array);
  return this;
};

{{G}}.utils.extend({{G}}.Collection, Array);

{{G}}.Collection.prototype.save = function (callback) {
  {{G}}._request(['collsave'], this, callback);
  return this;
};

{{G}}.Collection.prototype.toObject = function () {
};

{{G}}.Collection.prototype.toJSON = function () {
};

// Util methods
{{G}}.utils = {
  merge: function (target, source) {
    var key;

    for (key in source) {
      if (source.hasOwnProperty(key)) {
        target[key] = source[key];
      }
    }

    return target;
  },
  extend: function (Child, Parent) {
  },
};

if (Object.create) {
  {{G}}.utils.extend = function (Child, Parent) {
    Child.prototype = Object.create(Parent.prototype);
    Child.prototype.constructor = Child;
  };
} else {
  {{G}}.utils.extend = function (Child, Parent) {
    var Fn          = function () {};
    Fn.prototype    = Parent.prototype;
    Child.prototype = new Fn();
    Child.prototype.constructor = Child;
  };
}

if (Array.prototype.indexOf) {
  {{G}}.utils.indexOf = function (array, element) {
    return array.indexOf(element);
  };
} else {
  {{G}}.utils.indexOf = function (array, element) {
    for (var i = 0, il = array.length; i < il; i++) {
      if (element === array[i]) {
        return i;
      }
    }

    return -1;
  };
}

{{G}}.utils.EventEmitter = function EventEmitter() {
  this.listeners = {};
};

{{G}}.utils.EventEmitter.prototype = {
  emit: function emit(name) {

    if (this.listeners[name]) {
      var listener,
          args = Array.prototype.slice.call(arguments, 1);

      if ('function' === typeof this.listeners[name]) {
        this.listeners[name].apply(this, args);
      } else {
        for (var i = 0, il = this.listeners[name].length; i < il; i++) {
          this.listeners[name][i].apply(this, args);;
        }
      }
    }

    return this;
  },
  on: function addListener(name, fn) {
    if (!this.listeners[name]) {
      this.listeners[name] = fn;
    } else if ('function' === typeof this.listeners[name]) {
      this.listeners[name] = [this.listeners[name], fn];
    } else {
      this.listeners[name].push(fn);
    }
    return this;
  },
  removeListener: function (event, fn) {
    if (!this.listeners[event]) return this;
    else if ('function' === typeof this.listeners[event]) {
      if (this.listeners[event] === fn) {
        this.listeners[event] = null;
      }
      return this;
    }

    var listener,
        listeners;

    for (var i = 0, il = this.listeners[event].length; i < il; i++) {
      listener = this.listeners[event][i];

      if (listener !== fn) {
        listeners.push(listener);
      }
    }

    this.listeners[event] = listeners;
    return this;
  },
  removeAllListeners: function (event) {
    this.listeners[event] = null;
    return this;
  }
};

{{G}}.emitter = new {{G}}.utils.EventEmitter();
