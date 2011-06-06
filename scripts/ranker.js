function TagRanker(searchResults) {
  let me = this;
  me.searchResults = searchResults;
  me.utils = new AwesomeTabUtils();
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
      let tagFrequency = tagInfo[3];
      score += (1.44 * Math.log(1 + (1/tagFrequency))) * pHost * (isBookmarkedTag ? 4 : 1);
    });
    reportError("basic scoring done");
    // calculate document score
    me.ranks[placeId] = {
      "score" : score,
      "bookmarked": me.searchResults[placeId]["isBookmarked"],
      "hub": me.searchResults[placeId]["isHub"],
    }
  }
};

TagRanker.prototype.getResults = function() {
  let me = this;
  reportError(JSON.stringify(me.ranks));
  return me.ranks;
};
