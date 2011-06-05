function NewTab(doc, openURIs) {
  let me = this;
  me.MINUTE_CUTOFF = 10;
  me.openURIs = openURIs;
  me.builder = new NewtabBuilder(doc);
  me.utils = new NewtabUtils();
  me.setupNewtab();
}

NewTab.prototype.setupNewtab = function() {
  let me =this;
  let currentPlaces = me.getVisiblePlaces();
  /*
  let visitsMap = me.constructVisitsMap(currentPlaces);
  let nearPlacesMap = me.constructNearPlacesMap(visitsMap);
  let countMap = me.constructCountMap(nearPlacesMap);
  let sorted = me.sortCountMap(countMap);
  me.builder.enableBrowsedTogether();
  sorted.forEach(function(s) {
    me.builder.addToList("together", s[0], null);
  });
  Cu.reportError(JSON.stringify(sorted));
  */
  let tagMap = me.buildTagMap(currentPlaces);

  me.showSimilarBookmarks(tagMap);

};

function removeDuplicates(things) {
  var arr = {};
  for (let i = 0; i < things.length; i++) {
    arr[things[i]] = 1;
  }
  things = [];
  for (let k in arr) {
    things.push(k);
  }
  return things;
}

NewTab.prototype.showSimilarBookmarks = function(tagMap) {
  let me = this;
  let simpleTagMap = {};
  let places = [];
  for (let placeId in tagMap) {
    let matches = removeDuplicates(tagMap[placeId]).length;
    places.push([placeId, matches]);
  }

  if (places.length > 0) {
    me.builder.enableSimilarBookmarks();
  }

  places.sort(function (a,b) {
    return b[1] - a[1];
  }).forEach(function(p) {
    me.builder.addToList("similar", p[0]);
  });


}

NewTab.prototype.sortCountMap = function(countMap) {
  let me = this;
  let countArr = [];
  for (let k in countMap) {
    // normalization
    let visitCount = me.utils.getData(["visit_count"], {"id" : k}, "moz_places")[0]["visit_count"];
    countArr.push([k, (visitCount == 0) ? 0 : countMap[k]/visitCount])
  }
  return countArr.sort(function(a, b) {
    return b[1] - a[1];
  });
}

/* naive method #1 */
NewTab.prototype.constructCountMap = function(nearPlacesMap) {
  let me = this;
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

NewTab.prototype.getTagsFromPlace = function(placeId) {
  let me = this;
  function getPlaceInfo(pid) {
    let result = me.utils.getData(["url", "title"],{"id": pid},"moz_places");
    return result.length > 0 ? {"url": result[0]["url"], "title":result[0]["title"]} : null;
  }
  let placeInfo = getPlaceInfo(placeId);
  if (!placeInfo || !placeInfo["title"] || !placeInfo["url"])
    return;

  let taggingSvc = Cc["@mozilla.org/browser/tagging-service;1"]
                   .getService(Ci.nsITaggingService);
  let uri = Cc["@mozilla.org/network/io-service;1"]
            .getService(Ci.nsIIOService)
            .newURI(placeInfo["url"], null, null);
  let tags = taggingSvc.getTagsForURI(uri);
  if (!tags || tags.length == 0) {
    return null;
  }
  return tags;
}

NewTab.prototype.getPlacesFromTag = function(tag) {
  let me = this;
  let taggingSvc = Cc["@mozilla.org/browser/tagging-service;1"]
                   .getService(Ci.nsITaggingService);
  let uris = taggingSvc.getURIsForTag(tag);
  let places = [];
  uris.forEach(function(uri) {
    let placeData = me.utils.getData(["id"], {"url":uri.spec}, "moz_places");
    if (!placeData || placeData.length == 0) return;
    reportError("getting place id");
    let placeId = placeData[0]["id"];
    places.push(placeId);
  });
  reportError("places for tag " + tag + " are " + JSON.stringify(places));
  return places;
}

NewTab.prototype.buildTagMap = function(placeMap) {
  let me = this;
  let placeTagMap = {};
  let altTagMap = {};
  let usePlaceTagMap = false;
  for (let placeId in placeMap) {
    reportError("checking if " + placeId + " is a bookmark");
    if (me.utils.isBookmarked(placeId)) {
      reportError(placeId + " is bookmarked");
      let tags = me.getTagsFromPlace(placeId);
      reportError("tags for " + placeId + " are " + JSON.stringify(tags));
      if (!tags) continue;
      tags.forEach(function(tag) {
        reportError("checking for other places with tag" + tag);
        me.getPlacesFromTag(tag).forEach(function(p) {
          if (!(p in placeMap)) {
            if (p in placeTagMap) {
              placeTagMap[p].push(tag)
            } else {
              usePlaceTagMap = true;
              placeTagMap[p] = [tag];
            }
          }
        });
      });
      
    }

    function getTitleTags(placeId) {
      let placeData = me.utils.getData(["title"], {"id":placeId}, "moz_places");
      if (!placeData || placeData.length == 0 || !placeData[0].title) {
        return [];
      }
      return placeData[0]["title"].toLowerCase().split(/[\s-\_|]/).filter(function (w) {return w.match(/[a-z]/)})

    }
    for (let placeId in placeMap) {
      getTitleTags(placeId).forEach(function(tag) {
        me.getPlacesFromTag(tag).forEach(function(p) {
          if (!(p in placeMap)) {
            if (p in altTagMap) {
              altTagMap[p].push(tag);
            } else {
              altTagMap[p] = [tag];
            }
          }
        });
      });
    }
      
  }
  reportError(JSON.stringify(placeTagMap));
  reportError(JSON.stringify(altTagMap));
  return usePlaceTagMap ? placeTagMap : altTagMap;
};

function NewtabBuilder(doc) {
  let me = this;
  me.utils = new NewtabUtils();
  me.doc = doc;
};

NewtabBuilder.prototype.enableSimilarBookmarks = function() {
  let me = this;
  me.doc.getElementById('similar-bookmarks-container').style.display = 'block';
}

NewtabBuilder.prototype.enableBrowsedTogether = function() {
  let me = this;
  me.doc.getElementById('browsed-together-container').style.display = 'block';
}

NewtabBuilder.prototype.addToList = function(list, placeId, extra) {
  let me = this;
  function getPlaceInfo(pid) {
    let result = me.utils.getData(["url", "title"],{"id": pid},"moz_places");
    return result.length > 0 ? {"url": result[0]["url"], "title":result[0]["title"]} : null;
  }

  let placeInfo = getPlaceInfo(placeId);
  if (!placeInfo) {
    return;
  }

  let listElem = null;
  if (list == "similar") {
    listElem = me.doc.getElementById('similar-bookmarks');
  } else if (list == "together") {
    listElem = me.doc.getElementById('browsed-together');
  } else {
    return;
  }

  let li = me.doc.createElement('li');
  li.setAttribute('class', 'hbox');
  let div = me.doc.createElement('div');
  div.setAttribute('class', 'accountType overflow boxFlex');

  let span1 = me.doc.createElement('span');
  span1.setAttribute('class', 'icon');
  
  let img = me.doc.createElement('img');
  img.style.height = '16px';
  img.style.width = '16px';
  img.style.paddingRight = '4px';
  img.src = PlacesUtils.favicons.getFaviconImageForPage(Utils.makeURI(placeInfo["url"])).spec;
  

  let span2 = me.doc.createElement('span')
  let a = me.doc.createElement('a');
  a.setAttribute('href', placeInfo["url"].slice(0,50));
  a.innerHTML = placeInfo["title"] ? placeInfo["title"].slice(0,50) : "";
  span2.appendChild(a);

  let span3 = me.doc.createElement('span');
  span3.setAttribute('class', 'username');
  span3.innerHTML = " (1)";

  div.appendChild(img);
  div.appendChild(span2);
  div.appendChild(span3);
  li.appendChild(div);
  listElem.appendChild(li);
  
}

