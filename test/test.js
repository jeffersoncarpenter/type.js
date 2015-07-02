require('../type.js');

var eachTestMS = 100;

var assertType = function (t, obj) {
	var worked = true;
	checkTypesWith(function () {
		worked = false;
	})(t, obj);
	setTimeout(function () {
		if (worked !== true) {
			console.err('Type assertion failed: ' + t + obj);
		}
	});
};

var assertTypeError = function (t, obj) {
	var worked = false;
	checkTypesWith(function () {
		worked = true;
	})(t, obj);
	setTimeout(function () {
		if (worked !== true) {
			console.err('Type error assertion failed: ' + t + obj);
		}
	});
};

assertType(String, 'aoeu');
