var is = require('is');

var Type = {
	name: 'Type',
	check: function (obj, typeError) {
		if (!is.object(obj)) {
			typeError(obj);
		}
		if (!is.fn(obj.check)) {
			typeError(obj);
		}
		if (!is.string(obj.name)) {
			typeError(obj);
		}
	},
};


var checkTypesWith = function (f) {
	return function (t, obj) {
		return t.check(obj, function () {
			return f(t, obj);
		});
	};
};

var type = checkTypesWith(function (t, o) {
	var oName = is.fn(o) ? 'function' : JSON.stringify(o);
	message = 'type error: ' + oName + ' is not a ' + t.name;
	console.warn(message);
});

var id = function (obj) {
	return obj;
};


// everything is a Bottom
var Bottom = {
	name: 'Bottom',
	check: function (obj) {
		return obj;
	},
};


var String = {
	name: 'String',
	check: function (obj, typeError) {
		if (!is.string(obj)) {
			typeError(obj);
		}
		return obj;
	},
};


var Number = {
	name: 'Number',
	check: function (obj, typeError) {
		if (!is.number(obj)) {
			typeError(obj);
		}
		return obj;
	},
};


var Boolean = {
	name: 'Boolean',
	check: function (obj, typeError) {
		if (!is.bool(obj)) {
			typeError(obj);
		}
		return obj;
	},
};


var or = function (tys) {
	return {
		name: 'or(' + tys.reduce(function (a, t) { return a + t.name + ',\n' }, '') + ')',
		check: function (obj, typeError) {
			var newObj = obj;
			var matches = [];
			var tryIndex = function (i, data) {
				if (i === tys.length) {
					return typeError(obj);
				}
				newObj = tys[i].check(obj, function (a, data) {
					return tryIndex(i + 1, data);
				}, data);
			};
			tryIndex(0);

			return newObj;
		},
	};
};


var array = function (ty) {
	return {
		name: 'array(' + (ty ? ty.name : '') + ')',
		check: function (obj, typeError) {
			var name = 'array(' + (ty ? ty.name : '') + ')';
			
			if (!is.object(obj)) {
				typeError(obj);
				return obj;
			}
			if (ty) {
				return obj.map(function (v) {
					return type(ty, v);
				});
			}
			else {
				return obj;
			}
		},
	};
};


var promise = function (ty) {
	return {
		name: 'promise(' + (ty ? ty.name : '') + ')',
		check: function (obj, typeError) {
			var error = false;
			func().check(obj.then, function () {
				typeError();
				error = true;
			});
			if (error || !ty) {
				return obj;
			}
			else {
				return obj.then(function (result) {
					return type(ty, result);
				});
			}
		},
	};
};


var stream = function (ty) {
	return {
		name: 'stream(' + (ty ? ty.name : '') + ')',
		check: function (obj, typeError) {
			instance(Bacon.EventStream, 'stream').check(obj, typeError);
			if (ty) {
				return obj.map(function (v) {
					return type(ty, v);
				});
			}
			else {
				return obj;
			}
		},
	};
};


var object = function (desc) {
	var name = 'object(';
	for (var key in desc) {
		name += desc[key].name + ', ';
	}
	name += ')';
	return {
		name: name,
		check: function (obj, typeError) {
			if (!is.object(obj)) {
				typeError(obj);
			}
			for (var key in desc) {
				obj[key] = type(desc[key], obj[key]);
			}
			return obj;
		},
	};
};

var enumeration = function (options) {
	return {
		name: 'enumeration(' + options.reduce(function (s, o) { return s + o + ' ';}) + ')',
		check: function (obj, typeError) {
			var matchesOne = false;
			options.map(function (o) {
				if (o === obj) {
					matchesOne = true;
				}
			});
			if (!matchesOne) {
				typeError();
			}
			return obj;
		}
	};
};

var oneOf = function (defs) {
	var tagProp = '_tag';
	
	var ty = {
		check: function (obj, typeError) {
			return def[obj[tagProp]].check(obj, typeError);
		}
	};

	var name = 'oneOf(';
	
	for (var key in defs) {
		var def = defs[key];
		
		ty[key] = function (obj) {
			obj = type(def, obj);
			obj[tagProp] = key;
		};

		name += key + ': ' + def.name + ', ';
	};
	
	name += ')';
	ty.name = name;

	return ty;
};
var cases = function (obj, cs) {
	var tagProp = '_tag';
	return cs[obj[tagProp]](obj);
};

var instance = function (klass, name) {
	return {
		name: 'instance(' + name + ')',
		check: function (obj, typeError) {
			if (!(obj instanceof klass)) {
				typeError(obj);
			}
			return obj;
		},
	};
};


var func = function (types, outputType) {
	if (types && !is.array(types)) {
		types = [types];
	}
	return {
		name: 'func([' + (types ? types.reduce(function (s, t) { return s + t.name + ', '; }, '') : '') + '], ' + (outputType ? outputType.name : '') + ')',
		check: function (obj, typeError, executionData) {
			executionData = executionData || {};
			
			if (!is.fn(obj)) {
				typeError();
			}
			var checkResult = function (args, result) {
				if (outputType) {
					if (is.fn(outputType)) {
						return outputType.apply(window, args).check(result, function (a, resultResult) {
							return typeError(obj, {
								args: args,
								result: result,
								resultResult: resultResult,
							});
						}, executionData.resultResult);
					}
					else {
						return outputType.check(result, function (a, resultResult) {
							return typeError(obj, {
								args: args,
								result: result,
								resultResult: resultResult,
							});
						}, executionData.resultResult);
					}
				}
				else {
					return result;
				}
			};
			var checkArgs = function (args) {
				if (types) {
					for (var i = 0; i < types.length; i++) {
						args[i] = types[i].check(args[i], function () {
							typeError(obj, {
								args: args,
							});
						});
					}
				}
				if (executionData.result) {
					return checkResult(args, executionData.result);
				}
				var result = obj.apply(null, args);
				return checkResult(args, result);
			};

			if (executionData.args) {
				return checkArgs(executionData.args);
			}
			return function () {
				var args = arguments;
				return checkArgs(args);
			};
		},
	};
};


var poly = function () {

	var instances = [];

	var f = function () {
		for (var i = 0; i < instances.length; i++) {
			var instanceMatches = true;
			var instance = instances[i];

			for (var j = 0; j < instance.args.length; j++) {
				var arg = instance.args[j];

				arg.check(arguments[j], function () {
					instanceMatches = false;
				});
			}

			if (instanceMatches) {
				return instance.impl.apply(window, arguments);
			};
		}

		console.warn('no instance found');
		debugger;
	};

	f.instance = type(
		func([array(Type), func()]),
		function (args, impl) {
			instances.push({
				args: args,
				impl: impl,
			});
		});

	return f;
};

var map = poly();
map.instance([array()], function (arr, f) {
	return arr.map(f);
});
map.instance([promise()], function (p, f) {
	return p.then(f);
});

var reduce = poly();
reduce.instance([array()], function (arr, f, i) {
	return arr.reduce(f, i);
});


var typeclass = function () {

	var instances = [];

	var f = function () {
		for (var i = 0; i < instances.length; i++) {
			var instanceMatches = true;
			var instance = instances[i];

			for (var j = 0; j < instance.args.length; j++) {
				var arg = instance.args[j];

				arg.check(arguments[j], function () {
					instanceMatches = false;
				});
			}

			if (instanceMatches) {
				return instance.impl;
			};
		}

		console.warn('no instance found');
		debugger;
	};

	f.instance = type(
		func([array(Type), func()]),
		function (args, impl) {
			instances.push({
				args: args,
				impl: impl,
			});
		});

	return f;
};


var monad = typeclass(function (m) {
	return {
		return: function (a) {
			return m(a);
		},
		bind: function (a) {
		},
	};
});
// monad.instance([

var exports = {
	Type: Type,
	checkTypesWith: checkTypesWith,
	type: type,
	
	Bottom: Bottom,
	String: String,
	Number: Number,
	Boolean: Boolean,
	or: or,
	array: array,
	promise: promise,
	stream: stream,
	object: object,
	enumeration: enumeration,
	oneOf: oneOf,
	cases: cases,
	instance: instance,
	func: func,

	poly: poly,
};

var exportTo = function (obj) {
	for (var key in exports) {
		obj[key] = exports[key];
	}
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
	exportTo(global);
}
else {
	exportTo(window);
}
