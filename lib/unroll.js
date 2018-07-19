'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var grammar = void 0;

var isString = function isString(value) {
  return typeof value === 'string';
};

var throwIfNotAString = function throwIfNotAString(value) {
  var isStringifed = isStringifiedJSON(value);
  if (value && (!isString(value) || isStringifed)) {
    var errorValue = isStringifed ? value : JSON.stringify(value);
    throw new Error('Incorrect type for arg:"' + errorValue + '" - must be a string');
  }
};

var isStringifiedJSON = function isStringifiedJSON(value) {
  try {
    JSON.parse(value);
  } catch (e) {
    return false;
  }
  return true;
};

var parseValue = function parseValue(value) {
  try {
    return JSON.parse(value.match(/\[.*?\]/) ? value.slice(0) : value);
  } catch (e) {
    return value;
  }
};

var throwIfNoMatch = function throwIfNoMatch(value, matcher) {
  if (!value.match(matcher)) {
    throw new Error('Incorrect value for arg:"' + JSON.stringify(value) + '" - requires "' + matcher.toString().replace(/(\/)/g, '') + '"');
  }
};

function throwifNotNestedArray(data) {
  if (data[0].constructor !== Array) {
    throw new Error('You specified unroll, but did not specify any unrolledItems.\n       unroll=\' + ' + JSON.stringify(data) + ' \n       Check your values (is it a nested array?).');
  }
}

function extractDataFromDataArray(data) {
  throwifNotNestedArray(data);
  return { variableNames: data.slice(0, 1)[0], variableValues: data.slice(1) };
}

function extractDataFromDataTable(data) {
  throwIfNoMatch(data, /where:/);
  var dataRows = data.split(/\r?\n/).filter(function (row) {
    return !row.trim().match(/where:/) && row.trim();
  });

  var variableNames = dataRows[0].split('|').map(function (variableName) {
    return variableName.trim();
  });

  var variableValues = dataRows.slice(1).map(function (dataRow) {
    return dataRow.split('|').map(function (v) {
      var trimmedValue = v.trim();

      return isString(trimmedValue) && !Number.isNaN(Number(trimmedValue)) ? parseFloat(trimmedValue) : trimmedValue;
    });
  });

  return { variableNames: variableNames, variableValues: variableValues };
}

function extractData(data) {
  if (Array.isArray(data)) {
    return extractDataFromDataArray(data);
  } else if (isString(data)) {
    return extractDataFromDataTable(data);
  } else {
    throw new Error('unroll data should be a String or an Array. See docs!');
  }
}

var extractValue = function extractValue(value, arg) {
  var parsedValue = parseValue(value);

  if (arg.indexOf('.') > 0) {
    var nestedName = arg.split('.')[1];
    if (!nestedName || !parsedValue.hasOwnProperty(nestedName)) {
      throw new Error(nestedName + ' not found in arg: ' + JSON.stringify(parsedValue));
    }
    return parsedValue[nestedName];
  }

  return parsedValue;
};

var _isES7Async = function isAsync(func) {
  var string = func.toString().trim();

  return !!(
  // native
  string.match(/^async /) ||
  // babel (this may change)
  string.match(/return _ref(.*).apply/));
};

var isCallbackStyle = function isCallbackStyle(testFunc) {
  return testFunc.length === 2;
};

var getStringValue = function getStringValue(value) {
  var type = typeof value === 'undefined' ? 'undefined' : _typeof(value);
  if (type === 'object') {
    return JSON.stringify(value);
  } else if (type === 'number') {
    return value;
  }
  return '"' + value + '"';
};

/**
 * parameterizes test functions
 *
 * @param {String} title  title of test with parameterized values
 * @param {Function} testFunc test function
 * @param {Array|String} unrolledValues data table of values (nested array)
 */
function unroll(title, testFunc, unrolledValues) {
  if (!grammar) {
    throw new Error('No grammar specified: Use unroll.use() to specify test function');
  }

  var _callTestFunc = function _callTestFunc(testFunc, unrolledArgs) {
    if (_isES7Async(testFunc)) {
      return function () {
        return testFunc.apply(this, Array.prototype.slice.apply(arguments).concat(unrolledArgs));
      };
    } else if (isCallbackStyle(testFunc)) {
      return function (done) {
        testFunc(done, unrolledArgs);
      };
    }
    return function () {
      testFunc(unrolledArgs);
    };
  };

  var _extractData = extractData(unrolledValues),
      variableNames = _extractData.variableNames,
      variableValues = _extractData.variableValues;

  variableValues.forEach(function (unrolled) {
    var unrolledTestName = title;
    var unrolledArgs = {};
    if (unrolled.length !== variableNames.length) {
      throw new Error('mismatched number of unroll values passed in');
    }

    variableNames.forEach(function (key, index) {
      throwIfNotAString(variableNames[index]);
      unrolledArgs[key] = parseValue(unrolled[index]);
    });

    (unrolledTestName.match(/#\w+(\.\w+)?/g) || []).forEach(function (matchedArg) {
      var unrolledValue = unrolledArgs[matchedArg.replace('#', '').split('.')[0]];
      if (unrolledValue === null || unrolledValue === undefined) {
        return;
      }

      unrolledValue = extractValue(unrolledValue, matchedArg);
      unrolledTestName = unrolledTestName.replace(matchedArg, getStringValue(unrolledValue));
    });

    if (unrolledTestName.indexOf('#') > -1) {
      throw new Error('title not expanded as incorrect args passed in');
    }

    grammar(unrolledTestName, _callTestFunc(testFunc, unrolledArgs));
  });
}

unroll.use = function (testFn) {
  grammar = testFn;
  return grammar;
};

/* istanbul ignore next */
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = unroll;
} else {
  window.unroll = unroll;
}

