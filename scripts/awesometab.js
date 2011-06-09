function AwesomeTab(doc, utils, central, tagger) {
  let me = this;
  try {
  me.utils = utils;
  me.pos = new POSTagger();
  reportError("getting visible places");
  let visiblePlaces = me.getVisiblePlaces();
  let currentPlaces = me.getLastKVisiblePlaces(visiblePlaces, 3);
  reportError("collecting tags");
  reportError(JSON.stringify(currentPlaces));
  let collector = new TagCollector(currentPlaces, me.utils, tagger);
  let collectedTags = collector.getResults();
  let collectedHosts = collector.getHosts();
  reportError("searching tags");
  //let searcher = new Searcher(collectedTags, collectedHosts, visiblePlaces, me.utils);
  let searcher1 = new BookmarkSearch(collectedTags, collectedHosts, visiblePlaces, me.utils, central);
  let searcher2 = new AllSearch(collectedTags, collectedHosts, visiblePlaces, me.utils, central);

  let rankedResults1 = searcher1.getResults();
  let rankedResults2 = searcher2.getResults();
  reportError("showing results");
  let builder = new Builder(rankedResults2, doc, me.utils, me.collectedTitles);
  builder.show();
  } catch (ex) {
    reportError(JSON.stringify(ex));
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
  let lastKPlaces = {};
  for (let i = 0; i < data.length; i++) {
    let placeId = data[i]["place_id"];
    lastKPlaces[placeId] = visiblePlaces[placeId];
  }
  return lastKPlaces;
};


AwesomeTab.prototype.getVisiblePlaces = function() {
  let me = this;
  let gBrowser = Services.wm.getMostRecentWindow("navigator:browser").gBrowser;
  let visibleTabs = gBrowser.visibleTabs;
  let places = {};
  me.collectedTitles = {};
  for (let i = 0; i < visibleTabs.length; i++) {
    let tab = visibleTabs[i];
    if (tab.pinned) {
      continue;
    }
    let uri = gBrowser.getBrowserForTab(tab).currentURI.spec;
    // reportError(uri);
    let placesData = me.utils.getData(["id", "title", "url", "rev_host", "frecency"], {
        "url": uri
      }, "moz_places")
    for (let j = 0; j < placesData.length; j++) {
      let place = placesData[j];
      places[place["id"]] = place;
      me.collectedTitles[place["title"]] = placesData[j]["title"];
    }
  }
  return places;
}
