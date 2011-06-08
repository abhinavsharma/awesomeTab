function SiteCentral() {
  let me = this;
  me.utils = new AwesomeTabUtils();
  me.re_bad_substrings = new RegExp(/(\/post\/|\/article\/)/g);
  me.re_is_num = new RegExp(/[0-9]+\/{0,1}/g)
}

SiteCentral.prototype.isHub = function(placeId) {
  let me = this;
  let data = me.utils.getData(["url"], {"id":placeId},"moz_places");
  if (data.length == 0 || !data[0]["url"]) {
    return false;
  } else {
    return me.isURLHub(data[0]["url"]);
  }
}

/*
 * some heuristics, goal is to reject something very unlikely
 * to be a hub quickly.
 */
SiteCentral.prototype.isURLHub = function(url) {
  let me = this;
  if (!url) {
    return true;
  }
  url = url.split('?');
  if (url.length > 1) {
    if ((/^[a-z]=/).test(url[1])) {
      return false;
    }
  }

  url = url[0];
  let splitURL = url.split('/');

  /* Quick accept */
  if (splitURL.length < 4) {
    // 'http://www.mozilla.com' -> http: , "", www.mozilla.com
    return true;
  }
  
  /* Quick reject */
  if (url.length > 80) { // very unlikely to be a hub
    reportError(url + "TOO LONG");
    return false
  }
  
  if (me.re_bad_substrings.test(url)) {
    return false;
  }

  let r1 = url.match(/[0-9]+/g);
  if (r1 && !r1.reduce(function(p,c,i,a) {
        return (p && (c.length < 6))
      }, true)) {
    reportError(url + "more than 8 consecutive digits");
    return false; // if after removing slash, more than 8 consec digits
  }
  if (splitURL.length > 7) {
    reportError(url + "has too many slashes");
    return false; // craziest i've seen is https://www.amazon.com/gp/dmusic/mp3/player
  }
  
  if (splitURL[splitURL.length - 1] && me.re_is_num.test(splitURL[splitURL.length - 1])) {
    // ends with a number
    return false;
  }

  if (!splitURL.reduce(function(p,c){
        return (p && c.length < 40 && c.split(/[\-\_]/g).length < 3);
      }, true)) {
    reportError(url + "has component over 40 chars");
    return false;
  }
  return true;
}

SiteCentral.prototype.hubMapForHosts = function(hosts) {
  let me = this;
  let sqlQuery = "SELECT id, visit_count FROM (SELECT AVG(visit_count) " + 
    "as a FROM moz_places WHERE :condition) avg INNER JOIN " + 
    "(SELECT * FROM moz_places WHERE :condition) " + 
    "p ON p.visit_count > 5 * avg.a";
  let params = {
    condition : hosts.map(function(s) { return "rev_host = " + s}).join(' OR '),
  }
  me.hubMap = {};
  me.utils.getDataQuery(sqlQuery, params, ["id"]).forEach(function({id, visit_count}) {
    me.hubMap[id] = visit_count;
  });
  reportError(JSON.stringify(me.hubMap));
}

SiteCentral.prototype.isHubFromMap = function(placeId) {
  let me = this;
  return (placeId in me.hubMap);
}

function SessionCentral() {
  let me = this;
}
