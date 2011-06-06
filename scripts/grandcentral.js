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
