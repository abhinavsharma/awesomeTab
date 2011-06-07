AwesomeTabUtils = function() {
  let me = this;
  reportError("koala utils init");

  me.taggingSvc = Cc["@mozilla.org/browser/tagging-service;1"]
                  .getService(Ci.nsITaggingService);
  me.bmsvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
                   .getService(Ci.nsINavBookmarksService);
  me.ios = Cc["@mozilla.org/network/io-service;1"]
           .getService(Ci.nsIIOService);
  me.GET_PLACES_FROM_TAG = {};
  me.GET_PLACE_ID_FROM_URL = {}
};

AwesomeTabUtils.prototype.getCurrentWindow = function() {
  let me = this;
  let chromeWin = Services.wm.getMostRecentWindow("navigator:browser");
  let win = chromeWin.gBrowser.selectedBrowser.contentWindow;
  return win;
};

AwesomeTabUtils.prototype.getBookmarkTitleFromURL = function(url) {
  let me = this;
  let bookmarkIds = me.bmsvc.getBookmarkIdsForURI(me.ios.newURI(url, null, null));
  if (bookmarkIds.length == 0) {
    return null;
  }
  return me.bmsvc.getItemTitle(bookmarkIds[0]);
};

AwesomeTabUtils.prototype.getPlacesFromTag = function(tag) {
  let me = this;
  if (tag in me.GET_PLACES_FROM_TAG) {
    return me.GET_PLACES_FROM_TAG[tag];
  }
  let uris = me.taggingSvc.getURIsForTag(tag);
  let places = [];
  uris.forEach(function(uri) {
    let placeData = me.getData(["id"], {"url":uri.spec}, "moz_places");
    if (!placeData || placeData.length == 0) return;
    let placeId = placeData[0]["id"];
    places.push(placeId);
  });
  //reportError("places for tag " + tag + " are " + JSON.stringify(places));
  me.GET_PLACES_FROM_TAG[tag] = places;
  return places;;
}


AwesomeTabUtils.prototype.getCurrentURL = function() {
  return this.getCurrentWindow().location.href;
};

AwesomeTabUtils.prototype.getCurrentPlace = function() {
  return me.getData(["id"],{"url":me.getCurrentURL()},"moz_places")[0]["id"];
}

AwesomeTabUtils.prototype.isBookmarked = function(placeId) {
  let me = this;
  return (me.getData(["id"],{"fk":placeId},"moz_bookmarks").length > 0);
};

AwesomeTabUtils.prototype.getPlaceIdFromURL = function(url) {
  let me = this;
  if (url in me.GET_PLACE_ID_FROM_URL) {
    return me.GET_PLACE_ID_FROM_URL(url);
  }
  let result = this.getData(["id"], {"url" : url}, "moz_places");
  if (result.length == 0) {
    me.GET_PLACE_ID_FROM_URL(url) = null;
    return null;
  } else {
    me.GET_PLACE_ID_FROM_URL(url) = null;
    return result[0]["id"];
  }
};

AwesomeTabUtils.prototype.getDataQuery = function(query, params, select) {
  reportError(query);
  reportError(JSON.stringify(params));
  let result = [];
  spinQuery(PlacesUtils.history.DBConnection, {
    names: select,
    params: params,
    query: query,
  }).forEach(function(row) result.push(row));
  //reportError(JSON.stringify(result));
  return result;
}

AwesomeTabUtils.prototype.getData = function(fields, conditions, table) {
  let me = this;
  let queryString = "SELECT ";
  queryString += fields.join(',') + ' FROM ' + table + ' WHERE ';
  let conditionArr = [];
  for (let key in conditions) {
    conditionArr.push(key + " = :" + key + "_v");
  }
  queryString += conditionArr.join(" AND ");
  //reportError("query string constructed" + queryString);
  //reportError("statement created, parametrizing with " + JSON.stringify(conditions));
  let params = {};
  for ([k, v] in Iterator(conditions)) {
    //reportError("adding condition + " + k + " : " + v);
    params[k + "_v"] = v;
  }
  //reportError("params are" + JSON.stringify(stm.params));
  let ret = [];
  //reportError("executing statement");
  spinQuery(PlacesUtils.history.DBConnection, {
    names: fields,
    params: params,
    query: queryString,
  }).forEach(function(row) ret.push(row));
  //reportError("returing " + JSON.stringify(ret));
  return ret;
};

AwesomeTabUtils.prototype.updateData = function(id, data, table) {
  let queryString = "UPDATE " + table + " SET ";
  for ([k, v] in Iterator(data)) {
    queryString += k + " = :" + k + "_v ";
  }
  queryString += "WHERE id = :id";
  //reportError(queryString);
  let params = {
    id: id,
  }
  for ([k,v] in Iterator(data)) {
    params[k + "_v"] = v;
  }
  spinQuery(PlacesUtils.history.DBConection, {
    params: params,
    query: queryString,
  });
};

AwesomeTabUtils.prototype.insertData = function(data, table) {
  let flatData = [];
  for ([k,v] in Iterator(data)) {
    flatData.push(k);
  }
  let queryString = "INSERT INTO " + table + "(";
  queryString += flatData.join(',');
  queryString += ") VALUES ("
  queryString += flatData.map(function(d) {return ":" + d + "_v";}).join(',');
  queryString += ");";
  //reportError(queryString);
  let params = {};
  for ([k,v] in Iterator(data)) {
    params[k + "_v"] = v;
  }
  //reportError(JSON.stringify(stm.params));
  spinQuery(PlacesUtils.history.DBConnection, {
    params: params,
    query: queryString,
  });
};

AwesomeTabUtils.prototype.isValidURL = function(url) {
  if (url && url.indexOf("http") > -1) {
    return true;
  }
  return false;
};

AwesomeTabUtils.prototype.getCurrentTime = function(precision) {
  let time = new Date().getTime();
  if (!precision)
    precision = "o";
  return Math.floor({
    "o" : time,
    "s" : time / (1000),
    "m" : time / (1000 * 60),
    "h" : time / (1000 * 60 * 60),
    "d" : time / (1000 * 60 * 60 * 24)
  }[precision]);
};

