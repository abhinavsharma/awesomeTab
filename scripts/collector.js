function TagCollector(currentPlaces, utils) {
  let me = this;
  reportError("incoming open uri: " + JSON.stringify(currentPlaces));
  me.currentPlaces = currentPlaces;
  me.utils = utils;
  me.taggingSvc = Cc["@mozilla.org/browser/tagging-service;1"]
                  .getService(Ci.nsITaggingService);
  me.newURI = Cc["@mozilla.org/network/io-service;1"]
              .getService(Ci.nsIIOService).newURI;

}

TagCollector.prototype.getResults = function() {
  let me = this;
  let clusterMap = me.clusterByHost();
  let collectedTags = me.collectTags(clusterMap);
  reportError(JSON.stringify(collectedTags));
  return collectedTags;
}

TagCollector.prototype.getHosts = function() {
  let me = this;
  return me.allHosts;
}

/* returns { rev_host -> [placeId] } map */
TagCollector.prototype.clusterByHost = function() {
  let me = this;
  let resultMap = {};
  me.allHosts = [];
  for (let placeId in me.currentPlaces) {
    let placeInfo = me.utils.getData(["id", "rev_host"], {
      "id": placeId,
    }, "moz_places");
    if (placeInfo.length == 0 || !placeInfo[0]["id"] || !placeInfo[0]["rev_host"]) {
      return;
    }
    let id =  placeId;
    let revHost = placeInfo[0]["rev_host"];
    reportError("adding place to map");
    if (!(revHost in resultMap)) {
      me.allHosts.push(revHost);
      resultMap[revHost] = [id];
    } else {
      resultMap[revHost].push(id);
    }
  }
  reportError("returing clustered map: " + JSON.stringify(resultMap));
  return resultMap;
};

TagCollector.prototype.collectTags = function(clusterMap) {
  let me = this;
  let allTags = {};
  for (let revHost in clusterMap) {
    clusterMap[revHost].forEach(function (placeId) {
      let titleTags = me.getTitleTags(placeId);
      let bookmarkTags = me.getTagsFromPlace(placeId);
      if (bookmarkTags && bookmarkTags.length > 0) {
        bookmarkTags.forEach(function (bmTag) {
          if (!(bmTag in allTags)) {
            allTags[bmTag] = {
              "hosts": [revHost],
              "bookmarked": true,
            }
          } else {
            let resDict = allTags[bmTag];
            if (resDict["hosts"].indexOf(revHost) < 0) {
              resDict.push(revHost);
            }
            resDict["bookmarked"] = true;
            allTags[bmTag] = resDict;
          }
        });
      } else {
        if (titleTags && titleTags.length > 0) {
          titleTags.forEach(function (titleTag) {
            if (!(titleTag in allTags)) {
              allTags[titleTag] = {
                "hosts": [revHost],
                "bookmarked": false,
              }
            } else {
              let resDict = allTags[titleTag];
              if (resDict["hosts"].indexOf(revHost) < 0) {
                resDict["hosts"].push(revHost);
              }
              allTags[titleTag] = resDict;
            }
          });
        }
      }
    });
  }
  return allTags;
}

/*
 * returns list of tags for a given placeId
 * TODO: centralize regexes
 */
TagCollector.prototype.getTitleTags = function(placeId) {
  let me = this;
  let placeInfo = me.utils.getData(["title"], {"id":placeId}, "moz_places");
  if (placeInfo.length == 0 || !placeInfo[0]["title"]) {
    return;
  }
  let title = placeInfo[0]["title"];
  return title.toLowerCase().replace(/[\|\_]/).match(/[a-z]+/g);
}

TagCollector.prototype.getTagsFromPlace = function(placeId) {
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
  let uri = me.newURI(placeInfo["url"], null, null);
  let tags = me.taggingSvc.getTagsForURI(uri);
  if (!tags || tags.length == 0) {
    return null;
  }
  return tags;
}

