function SiteCentral() {
  let me = this;
  me.utils = new AwesomeTabUtils();
}

SiteCentral.prototype.isHub = function(placeId) {
  let me = this;
  let sqlQuery = "SELECT * FROM (SELECT p.id as id FROM " + 
    "(SELECT * FROM moz_places WHERE id=:placeId) src INNER JOIN moz_places p " + 
    "ON src.rev_host = p.rev_host ORDER BY p.frecency DESC LIMIT 1) res " + 
    "WHERE res.id = :placeId";
  return  me.utils.getDataQuery(sqlQuery, {
      "placeId" : placeId,
    }, ["id"]).length > 0;
}

/*
 * some heuristics, goal is to reject something very unlikely
 * to be a hub quickly.
 */
SiteCentral.prototype.isURLHub = function(url) {
  if (url.length > 80) { // very unlikely to be a hub
    return false
  }
  if (!url.match(/[0-9]+/g).reduce(function(p,c,i,a) {
        return (p && (c.length < 8))
      }, true)) {
    return false; // if after removing slash, more than 8 consec digits
  }
  let splitURL = url.split('/');
  if (splitURL.length > 7) {
    return false; // craziest i've seen is https://www.amazon.com/gp/dmusic/mp3/player
  }
  if (!splitURL.reduce(function(p,c){
        return (p && c.length < 15);
      }, true)) {
    return false;
  }


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
