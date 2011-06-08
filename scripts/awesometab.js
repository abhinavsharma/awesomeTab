function AwesomeTab(doc) {
  let me = this;
  try {
  me.utils = new AwesomeTabUtils();
  reportError("getting visible places");
  let visiblePlaces = me.getVisiblePlaces();
  let currentPlaces = me.getLastKVisiblePlaces(visiblePlaces, 5);
  reportError("collecting tags");
  let collector = new TagCollector(currentPlaces, me.utils);
  let collectedTags = collector.getResults();
  let collectedHosts = collector.getHosts();
  reportError("searching tags");
  let searcher = new Searcher(collectedTags, collectedHosts, visiblePlaces, me.utils);
  let searcher2 = new AllSearch(collectedTags, collectedHosts, visiblePlaces, me.utils);

  let searchResults = searcher.getResults();
  reportError("ranking tags");
  let ranker = new TagRanker(searchResults, me.utils);
  let rankedResults = ranker.getResults();
  reportError("showing results");
  let builder = new Builder(rankedResults, doc, me.utils);
  builder.show();
  } catch (ex) {
    reportError(ex);
  }
}

AwesomeTab.prototype.getLastKVisiblePlaces = function(visiblePlaces, k) {
  let me = this;
  let condition = Object.keys(visiblePlaces).map(function(placeId) {
    return "place_id=" + placeId;
  }).join(" OR ");
  let sqlQuery = "SELECT place_id FROM moz_historyvisits WHERE " + condition +" GROUP BY "
    +"place_id ORDER BY id DESC LIMIT " + k;
  let params = {
  }
  let data =  me.utils.getDataQuery(sqlQuery, params, ["place_id"])
  reportError(JSON.stringify(data));
  return data.map(function({place_id}) {return place_id;})
};


AwesomeTab.prototype.getVisiblePlaces = function() {
  let me = this;
  let gBrowser = Services.wm.getMostRecentWindow("navigator:browser").gBrowser;
  let visibleTabs = gBrowser.visibleTabs;
  let places = {};
  visibleTabs.forEach(function(tab) {
    let uri = gBrowser.getBrowserForTab(tab).currentURI.spec;
    // reportError(uri);
    me.utils.getData(["id"], {"url": uri}, "moz_places").forEach(function(p) {
      if (p["id"] in places) {
        places[p["id"]] += 1;
      } else {
        places[p["id"]] = 1;
      }
    });
  });
  return places;
}

