function BookmarkSearch(collectedTags, collectedHosts, excludedPlaces, utils, central) {
  let me = this;
  me.utils = utils;
  me.idfMap = {};
  me.tfMap = {};
  me.ranks = {}
  me.central = central;
  me.collectedTags = collectedTags;
  me.excludedPlaces = excludedPlaces;
  let tagRow = me.utils.getData(["rowid"], {"root_name": "tags"}, "moz_bookmarks_roots");
  if (tagRow.length == 0) {
    return;
  }
  me.rowid = tagRow[0]["rowid"];
  me.N = me.utils.getDataQuery("SELECT COUNT(1) as n FROM moz_bookmarks WHERE parent = :rowid", {
    "rowid" : me.rowid
  }, ["n"])[0]["n"];
  if (me.N == 0) {
    return;
  }
  me.createIDFMap();
  me.searchQuery();
}

BookmarkSearch.prototype.createIDFMap = function() {
  let me = this;
  for (let tag in me.collectedTags) {
    let n = me.utils.getDataQuery("SELECT COUNT(1) as n FROM " + 
      "(SELECT * FROM moz_bookmarks WHERE parent= :rowid AND title= :tag) s " + 
      "JOIN moz_bookmarks b on s.id = b.parent", {
        "rowid" : me.rowid,
        "tag": tag,
      }, ["n"])[0]["n"];
    me.idfMap[tag] = Math.log((me.N - n + 0.5)/(n + 0.5));
    me.tfMap[tag] = 1;
  }
}

BookmarkSearch.prototype.searchQuery = function() {
  let me = this;
  let condition = [];
  let i = 0;
  let params = {};
  for (let tag in me.collectedTags) {
    condition.push("title = :tag" + i);
    params["tag" + i] = tag;
    i++;
  }

  /* no tags to search for */
  if (condition.length == 0) {
    return;
  }
  condition = condition.join(' OR ');
  params["rowid"] = me.rowid;
  // TODO: test performance against compute score in query version
  let query = "SELECT p.id as id, h.title as tag, p.url as url, p.title as title, " + 
    "p.rev_host as rev_host, p.frecency as frecency FROM (SELECT b.fk, t.title FROM " + 
    "(SELECT * FROM moz_bookmarks WHERE parent= :rowid AND (" + condition + ")) t " + 
    "JOIN moz_bookmarks b ON b.parent = t.id) h JOIN moz_places p ON p.id = h.fk LIMIT 10;"
  me.ranks = {};
  me.utils.getDataQuery(query, params, ["id", "tag", "url", "title", "frecency"])
    .forEach(function({id, tag, url, title, frecency}) {
    if (!(id in me.ranks)) {
      me.ranks[id] = {
        "score": me.idfMap[tag],
        "frecency": frecency,
        "bookmarked": true,
        "hub": me.central.isHub(id),
        "tags": [tag],
        "title": title, //TODO replace with the one from bmsvc
        "url": url,
      }
    } else {
      me.ranks[id]["tags"].push(tag)
      me.ranks[id]["score"] += me.idfMap[tag];
    }
  });
}

BookmarkSearch.prototype.getResults = function() {
  let me = this;
  return me.ranks;
};
