function TagRanker(searchResults, utils) {
  let me = this;
  me.searchResults = searchResults;
  me.utils = utils;
  me.rank();
};

TagRanker.prototype.rank = function() {
  let me = this;
  me.ranks = {};
  for (let placeId in me.searchResults) {
    let score = 0;
    reportError("place id is " + placeId);
    // TODO: migrate to a variation of BM25
    me.searchResults[placeId]["tags"].forEach(function(tagInfo) {
      let tag = tagInfo[0];
      let isBookmarkedTag = tagInfo[1];
      let pHost = tagInfo[2];
      let idf = tagInfo[3];
      score += idf;
    });
    reportError("basic scoring done");
    // calculate document score
    me.ranks[placeId] = {
      "score" : score,
      "bookmarked": me.searchResults[placeId]["isBookmarked"],
      "hub": me.searchResults[placeId]["isHub"],
      "tags": me.searchResults[placeId]["tags"],
    }
  }
};

TagRanker.prototype.getResults = function() {
  let me = this;
  reportError(JSON.stringify(me.ranks));
  return me.ranks;
};
