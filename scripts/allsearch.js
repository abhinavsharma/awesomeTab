/*
 * Its like the allspark, but the allsearch instead
 * Does searching + ranking in moz_places
 */

function AllSearch(collectedTags, collectedHosts, excludedPlaces, utils, central) {
  let me = this;
  me.utils = utils;
  me.excludedPlaces = excludedPlaces;
  // TODO: construct a faster base table
  me.BASE_TABLE = "";
  me.N = me.utils.getDataQuery("SELECT COUNT(1) as N FROM moz_places;", 
    {}, ["N"])[0]["N"];
  me.collectedTags = collectedTags;
  me.MIN_VISIT_COUNT = 5;
  me.MAX_PLACES = 1000;
  me.idfMap = {};
  me.tfMap = {};
  me.central = central;
  me.createIDFMap();
  me.avgdl = me.utils.getDataQuery("SELECT AVG(length(title)) as a FROM moz_places WHERE length(title) > 0", 
    {}, ["a"])[0]["a"];
  me.avgdl = me.avgdl > 0 ? me.avgdl : 42; // no joke this is about the average from random sampling
  reportError(me.avgdl);
  me.searchQuery();
}

// TODO: make this faster, cut tags, pos tagging, etc, memoize,
AllSearch.prototype.createIDFMap = function() {
  let me = this;
  for (let tag in me.collectedTags) {
    let n = me.utils.getDataQuery("SELECT COUNT(1) as n FROM moz_places" +
      " WHERE title LIKE :tag", {
        "tag" : "%" + tag + "%"
      }, ["n"])[0]["n"];
    me.idfMap[tag] = Math.log((me.N - n + 0.5)/(n + 0.5));
    // TODO : account for whether tag comes from a  make changes to collector
    me.tfMap[tag] = me.collectedTags[tag]["hosts"].length;
    reportError("done with idf map" + JSON.stringify(me.idfMap) + JSON.stringify(me.tfMap));
  }
}


/* 
 * The problem with using the proper Okapi formula is that everything has a slightly different
 * score and the secondary sort by frecency becomes useless but this is not what we want.
 *
 * The problem is due to doclen, not because of tf. Plus, good websites have terrible titles 
 * and there's not much that can be done about it.
 *
 * Another point about not looking in the title string for the tf is that that makes it
 * really easy to game the system and have a really high score by multiple instances.
 * Collecting tf across different hosts helps normalize that to some extent.
 */
AllSearch.prototype.searchQuery = function() {
  let me = this;
  let iS = ["id", "url", "title", "frecency", "visit_count"];
  let i = 0;
  let mS = [], kS = [], tS = [];
  let params = {};
  let allTags = {};
  for (let tag in me.collectedTags) {
    mS.push("(title LIKE :str" + i + ") as v" + i);
    kS.push(":idf" + i + " * " + 
      //"((3 * :tf"+i+") / (2*(1 - 0.75 + 0.75 * (length(title)/:avgdl)) + :tf"+i+")) * "+ // Okapi proper
      "((3 * :tf"+i+") / (2 + :tf"+i+")) * "+ // Okapi without doclen normalization
      "(title LIKE :str" + i + ")");
    tS.push("v"+i);
    allTags["v"+i] = tag;
    params["str"+i] = "%" + tag +"%";
    params["idf"+i] = me.idfMap[tag] ;
    params["tf"+i] = me.tfMap[tag];
    i++;
  }
  //params["avgdl"] = me.avgdl;
  iSelect = iS.concat(mS).join(',') + "," + kS.join('+') + " as score";
  let iCond = "visit_count > 2 AND length(title) > 0 AND score > 0";
  let query = "SELECT " + iSelect + " FROM moz_places WHERE " + iCond + " ORDER BY score DESC";
  try {
  var result = me.utils.getDataQuery(query, params, iS.concat(tS).concat(["score"]));
  } catch (ex) { reportError(JSON.stringify(ex)) };
  me.ranks = {};
  result.forEach(function(data) {
    if (data.id in me.excludedPlaces) {
      return;
    }
    let tags = [];
    tS.forEach(function(i) {
      if (data[i] == 1) tags.push(allTags[i]);
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
