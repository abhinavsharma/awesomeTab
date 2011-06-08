/*
 * Its like the allspark, but the allsearch instead
 * Does searching + ranking in moz_places
 */

function AllSearch(collectedTags, collectedHosts, excludedPlaces, utils) {
  let me = this;
  me.utils = utils;
  me.excludedPlaces = excludedPlaces;
  me.N = me.utils.getDataQuery("SELECT COUNT(1) as N FROM moz_places;", 
    {}, ["N"])[0]["N"];
  me.collectedTags = collectedTags;
  me.MIN_VISIT_COUNT = 5;
  me.MAX_PLACES = 1000;
  me.idfMap = {};
  me.central = new SiteCentral();
  me.BASE_TABLE = "(SELECT id, url, title,frecency,visit_count FROM moz_places WHERE " + 
                  "visit_count > " + me.MIN_VISIT_COUNT + " ORDER BY " + 
                  "visit_count DESC LIMIT " + me.MAX_PLACES + ") base";
  me.createIDFMap();
  me.searchQuery();
}

// TODO: make this faster, cut tags, pos tagging, etc, memoize,
AllSearch.prototype.createIDFMap = function() {
  let me = this;
  for (let tag in me.collectedTags) {
    let n = me.utils.getDataQuery("SELECT COUNT(1) as n FROM " +  me.BASE_TABLE + 
      " WHERE title LIKE :tag", {
        "tag" : "%" + tag + "%"
      }, ["n"])[0]["n"];
    me.idfMap[tag] = Math.log((me.N - n + 0.5)/(n + 0.5));
    reportError("done with idf map" + JSON.stringify(me.idfMap));
  }
}

AllSearch.prototype.searchQuery = function() {
  let me = this;
  let iS = ["id", "url", "title", "frecency", "visit_count"];
  let i = 0;
  let mS = [], kS = [], tS = [];
  let params = {};
  let allTags = {};
  for (let tag in me.collectedTags) {
    mS.push("(title LIKE :str" + i + ") as v" + i);
    kS.push(":idf" + i +" * (title LIKE :str" + i + ")");
    tS.push("v"+i);
    allTags["v"+i] = tag;
    params["str"+i] = "%" + tag +"%";
    params["idf"+i] = me.idfMap[tag];
    i++;
  }
  iSelect = iS.concat(mS).join(',') + "," + kS.join('+') + " as score";
  let iCond = "visit_count > 2 AND length(title) > 0 AND score > 0";
  let query = "SELECT " + iSelect + " FROM moz_places WHERE " + iCond + " ORDER BY score DESC";
  let result = me.utils.getDataQuery(query, params, iS.concat(tS).concat(["score"]));
  me.ranks = {};
  result.forEach(function(data) {
    if (data.id in me.excludedPlaces) {
      return;
    }
    let tags = [];
    tS.forEach(function(i) {
      if (data[i] == 1) tags.push([allTags[i], true, 0.1, me.idfMap[allTags[i]]]);
    });
    me.ranks[data.id] = {
      "score": data.score,
      "frecency": data.frecency,
      "bookmarked": true,
      "hub": me.central.isHub(data.id),
      "tags": tags,
    }
  });
  reportError(JSON.stringify(me.ranks));
}

AllSearch.prototype.getResults = function() {
  let me = this;
  return me.ranks;
}
