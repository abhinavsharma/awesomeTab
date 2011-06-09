function TagCollector(currentPlaces, utils, pos) {
  let me = this;
  reportError("incoming open uri: " + JSON.stringify(currentPlaces));
  me.currentPlaces = currentPlaces;
  me.utils = utils;
  me.pos = pos;
  me.taggingSvc = Cc["@mozilla.org/browser/tagging-service;1"]
                  .getService(Ci.nsITaggingService);
  me.newURI = Cc["@mozilla.org/network/io-service;1"]
              .getService(Ci.nsIIOService).newURI;

}

TagCollector.prototype.getResults = function() {
  let me = this;
  let clusterMap = me.clusterByHost();
  let collectedTags = me.collectTags(clusterMap);
  reportError(JSON.stringify(me.pos.tag(Object.keys(collectedTags))));
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
  reportError(JSON.stringify(me.currentPlaces));
  for (let placeId in me.currentPlaces) {
    let revHost = me.currentPlaces[placeId]["rev_host"];
    if (revHost.length < 3) {
      continue;
    }
    if (!(revHost in resultMap)) {
      me.allHosts.push(revHost);
      resultMap[revHost] = [placeId];
    } else {
      resultMap[revHost].push(placeId);
    }
  }
  reportError("returing clustered map: " + JSON.stringify(resultMap));
  return resultMap;
};

/*
 * Type 1:  tag from bookmark tag
 * Type 2: tag from title
 * TOD: use POS tagger here.
 */
TagCollector.prototype.rejectTag = function(tag) {
  return (tag in STOPWORDS);
}

TagCollector.prototype.collectTags = function(clusterMap) {
  let me = this;
  let allTags = {};
  for (let revHost in clusterMap) {
    let places = clusterMap[revHost];
    for (let p = 0; p < places.length; p++) {
      let placeId = places[p];
      let titleTags = me.getTitleTags(placeId);
      let bookmarkTags = me.getTagsFromPlace(placeId);
      if (bookmarkTags && bookmarkTags.length > 0) {
        for (let i = 0; i < bookmarkTags.length; i++) {
          let bmTag = bookmarkTags[i];
          if (me.rejectTag(bmTag, 1)) {
            continue;
          }
          if (!(bmTag in allTags)) {
            allTags[bmTag] = {
              "hosts": [revHost],
              "bookmarked": true,
            }
          } else {
            let resDict = allTags[bmTag];
            reportError(JSON.stringify(resDict["hosts"]));
            if (resDict["hosts"].indexOf(revHost) < 0) {
              resDict["hosts"].push(revHost);
            }
            resDict["bookmarked"] = true;
            allTags[bmTag] = resDict;
          }
        }
      } else {
        if (titleTags && titleTags.length > 0) {
          for (let i = 0; i < titleTags.length; i++) {
            let titleTag = titleTags[i];
            if (me.rejectTag(titleTag, 2)) {
              continue;
            }
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
          }
        }
      }
    }
  }
  return allTags;
}

/*
 * returns list of tags for a given placeId
 * TODO: centralize regexes
 */
TagCollector.prototype.getTitleTags = function(placeId) {
  let me = this;
  let title = me.currentPlaces[placeId]["title"];
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

