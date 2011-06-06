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


function SessionCentral() {
  let me = this;
}
