function NewTab(doc, openURIs) {
  let me = this;
  me.MINUTE_CUTOFF = 60;
  me.openURIs = openURIs;
  me.builder = new NewtabBuilder(me.doc);
  me.utils = new NewtabUtils();
  me.setupNewtab();

}

NewTab.prototype.setupNewtab = function() {
  let me =this;
  let currentPlaces = me.getVisiblePlaces();
  let visitsMap = me.constructVisitsMap(currentPlaces);
  let nearPlacesMap = me.constructNearPlacesMap(visitsMap);
  let countMap = me.constructCountMap(nearPlacesMap);
  let sorted = me.sortCountMap(countMap);
  Cu.reportError(JSON.stringify(sorted));
};

NewTab.prototype.sortCountMap = function(countMap) {
  let countArr = [];
  for (let k in countMap) {
    countArr.push([k, countMap[k]])
  }
  return countArr.sort(function(a, b) {
    return b[1] - a[1];
  });
}

/* naive method #1 */
NewTab.prototype.constructCountMap = function(nearPlacesMap) {
  let countMap = {};
  for (let placeId in nearPlacesMap) {
    for (let simPlace in nearPlacesMap[placeId]) {
      if (simPlace in nearPlacesMap) {
        continue;
      } 
      if (simPlace in countMap) {
        countMap[simPlace] += nearPlacesMap[placeId][simPlace];
      } else {
        countMap[simPlace] = nearPlacesMap[placeId][simPlace];
      }
    }
  }
  return countMap;
};

NewTab.prototype.constructVisitsMap = function(places) {
  let me = this;
  let HISTORY_CUTOFF = 25;
  let visitsMap = {};
  for (let placeId in places) {
    let sqlQuery = "SELECT DISTINCT ((visit_date)/(1000 * 60 * :min)) as time_bucket " + 
      "FROM moz_historyvisits " + 
      "WHERE place_id = :placeId " + 
      "ORDER BY time_bucket DESC LIMIT :lim";
    let params = {
      "placeId" : placeId,
      "lim" : HISTORY_CUTOFF,
      "min": me.MINUTE_CUTOFF
    }
    visitsMap[placeId] = [];
    me.utils.getDataQuery(sqlQuery, params, ["time_bucket"]).forEach(function(b) {
      visitsMap[placeId].push(b["time_bucket"]);
    });
  }
  reportError(JSON.stringify(visitsMap));
  return visitsMap;
}

NewTab.prototype.constructNearPlacesMap = function(visitsMap) {
  let me = this;
  let nearPlacesMap = {};
  for (let placeId in visitsMap) {
    // TODO: account for empty
    let conditionArr = [];
    visitsMap[placeId].forEach(function(tb) {
      conditionArr.push("time_bucket=" + tb);
    });
    if (conditionArr.length == 0) {
      nearPlacesMap[placeId] = {};
      continue;
    }
    reportError("consition array done");
    let condition = conditionArr.join(" OR ");
    let sqlQuery = "SELECT place_id, num_visits FROM " + 
      "(SELECT ((visit_date)/(1000 * 60  * :min )) as time_bucket, " + 
      "COUNT(1) as num_visits, place_id " + 
      "FROM moz_historyvisits " + 
      "GROUP BY place_id) " +
      "WHERE " + condition; 

    let simDict = {};
    let params = {
      "min": me.MINUTE_CUTOFF
    }
    reportError("looking for similar places for " + placeId);
    me.utils.getDataQuery(sqlQuery, params, ["place_id", "num_visits"]).forEach(function(s) {
      if (placeId != s["place_id"]) {
         simDict[s["place_id"]] = s["num_visits"];
      }
    });
    reportError("similar places found: " + JSON.stringify(simDict));
    nearPlacesMap[placeId] = simDict;
  }
  reportError(JSON.stringify(nearPlacesMap));
  return nearPlacesMap;
}

NewTab.prototype.getVisiblePlaces = function() {
  let me = this;
  let gBrowser = Services.wm.getMostRecentWindow("navigator:browser").gBrowser;
  let visibleTabs = gBrowser.visibleTabs;
  let places = {};
  visibleTabs.forEach(function(tab) {
    let uri = gBrowser.getBrowserForTab(tab).currentURI.spec;
    reportError(uri);
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



function NewtabBuilder(doc) {
  let me = this;
  me.doc = doc;
};

