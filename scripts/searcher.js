function Searcher(collectedTags, collectedHosts) {
  let me = this;
  me.utils = new AwesomeTabUtils();
  me.central = new SiteCentral();
  me.collectedHosts = collectedHosts;
  me.numHosts = collectedHosts.length;
  me.collectedTags = collectedTags;
  me.placesMap = me.getPlaces(me.collectedTags);
}

Searcher.prototype.getPlaces = function(collectedTags) {
  let me = this;
  let places = {};
  for (let tag in collectedTags) {
    let tagInfo = collectedTags[tag];
    let p = tagInfo["hosts"].length / me.numHosts;
    me.utils.getPlacesFromTag(tag).forEach(function(placeId) {
      if (!(placeId in places)) {
        places[placeId] = {
          "tags"  : [[tag, tagInfo["bookmarked"], p, me.utils.getPlacesFromTag(tag).length]],
          "isHub" : me.central.isHub(placeId),
          "isBookmarked" : me.utils.isBookmarked(placeId),
        };
      } else {
        let resDict = places[placeId];
        reportError("resdict is " + resDict);
        resDict.tags.push([tag, tagInfo["bookmarked"], p, me.utils.getPlacesFromTag(tag).length]);
        places[placeId] = resDict;
      }
    });
  }
  return places;
};

Searcher.prototype.getResults = function() {
  let me = this;
  reportError(JSON.stringify(me.placesMap));
  return me.placesMap;
}
