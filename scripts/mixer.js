function Mixer(bmSearch, allSearch, collectedTitles, utils) {
  let me = this;

  let includedTitles = {};
  let includedPlaces = {};
  let placeArr = [];
  
  reportError(J(bmSearch));
  reportError(J(allSearch));

  for (let placeId in bmSearch) {
    if (bmSearch["frecency"] < 100) {
      continue;
    }
    let url = bmSearch[placeId]["url"];
    let placeTitle = bmSearch[placeId]["title"];
    let bmTitle = utils.getBookmarkTitleFromURL(url);
    bmTitle = bmTitle ? bmTitle : placeTitle;
    if (placeId in includedPlaces ||
        bmTitle in includedTitles || 
        bmTitle in collectedTitles ||
        placeTitle in includedTitles ||
        placeTitle in collectedTitles) {
      continue;
    }
    includedTitles[bmTitle] = 1;
    includedTitles[placeTitle] = 1;
    includedPlaces[placeId] = 1;
    let result = bmSearch[placeId];
    result["bmEngine"] = 1;
    result["title" ] = bmTitle;
    reportError(J(result));
    placeArr.push(result);
  }

  for (let placeId in allSearch) {
    if (allSearch["frecency"] < 100) {
      continue;
    }

    let url = allSearch[placeId]["url"];
    let placeTitle = allSearch[placeId]["title"];
    if (placeId in includedPlaces ||
        placeTitle in includedTitles ||
        placeTitle in collectedTitles) {
      continue;
    }
    includedTitles[placeTitle] = 1;
    includedPlaces[placeId] = 1;
    let result = allSearch[placeId];
    result["bmEngine"] = 0;
    reportError(J(result));
    placeArr.push(result);


  }

  reportError(J(placeArr));

  placeArr.sort(function (p1, p2) {
    /* prioritize results from the bookmark search engine */
    let bmDiff = p2["bmEngine"] - p1["bmEngine"];
    if (bmDiff != 0) {
      return bmDiff;
    }

    /* given that they are same engine, use scoring */
    let scoreDiff = p2["score"] - p1["score"];
    if (scoreDiff != 0) {
      return scoreDiff;
    }

    /* finally, use frecency*/
    let frecencyDiff = p2["frecency"] - p1["frecency"];
    if (frecencyDiff != 0) {
      return frecencyDiff;
    }
    return 0;
  });

  reportError(J(placeArr));

  me.places = placeArr;
}

Mixer.prototype.getMixed = function() {
  reportError(J(this.places));
  return this.places;
}
