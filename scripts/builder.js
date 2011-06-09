function Builder(rankedResults, doc, utils, collectedTitles) {
  let me = this;
  me.doc = doc;
  me.utils = utils;
  me.collectedTitles = collectedTitles;
  me.rankedResults = rankedResults;
  me.results = {
    "bThT": [],
    "bThF": [],
    "bFhT": [],
    "bFhF": [],
  }
  for (let placeId in rankedResults) {
    let place = rankedResults[placeId];
    let score = place.score;
    let tags = place.tags;
    let frecency = place.frecency ? place.frecency : 0;
    if (place.bookmarked && place.hub) {
      me.results["bThT"].push([placeId, score, frecency, tags]);
    } else if (DEBUG && place.bookmarked && !place.hub) {
      me.results["bThF"].push([placeId, score, frecency, tags]);
    } else if (!place.bookmarked && place.hub) {
      me.results["bFhT"].push([placeId, score, frecency, tags]);
    } else if (DEBUG){
      me.results["bFhF"].push([placeId, score, frecency, tags]);
    }
  };

  for (let k in me.results) {
    me.results[k] = me.results[k].sort(function(a,b) {
      return b[1] - a[1] !=0 ? b[1] - a[1] : b[2] - a[2];
    });
  }
}

Builder.prototype.show = function() {
  let me = this;
  reportError(JSON.stringify(me.results));
  let $ = me.doc.getElementById;

  function populate(results, type) {
    $(type + '-table').style.display = "block";
    
    /* this is a hacky solution to the page states problem - pandora.com/ and pandora/#inactive */
    let shownTitles = {};

    results.forEach(function (a) {
      let placeId = a[0];
      let score = a[1];
      let frecency = a[2];
      let tags = a[3];

      let placeInfo = me.utils.getData(["url", "title"], {"id":placeId}, "moz_places");
      if (!placeInfo || placeInfo.length == 0 || !(placeInfo = placeInfo[0]) || !placeInfo["title"] || !placeInfo["url"]) {
        reportError("fail " + JSON.stringify(placeInfo));
        return;
      }
      let title = me.rankedResults[placeId]["title"];
      let url = me.rankedResults[placeId]["url"];
      if (!title || !url) {
        return;
      }
      if (title in shownTitles || title in me.collectedTitles) {
        return;
      } else {
        shownTitles[title] = 1;
      }

      /*
      let img = me.doc.createElement('img');
      img.style.height = '16px';
      img.style.width = '16px';
      img.style.paddingRight = '4px';
      img.src = PlacesUtils.favicons.getFaviconImageForPage(Utils.makeURI(placeInfo["url"])).spec;
      */

      let bmImg = me.doc.createElement('img');
      bmImg.style.height = '16px';
      bmImg.style.width = '16px';
      bmImg.src = 'img/star.png';
      bmImg.style.visibility = me.utils.isBookmarked(placeId) ? 'visible' : 'hidden';

      let link = me.doc.createElement('a');
      link.setAttribute('href', url);
      let bmTitle = me.utils.getBookmarkTitleFromURL(url);

      link.innerHTML = (bmTitle ? bmTitle : title.slice(0,75));

      let row = me.doc.createElement('tr');
      let cell = me.doc.createElement('td');
      cell.appendChild(link);
      let cell2 = me.doc.createElement('td');
      cell2.innerHTML = JSON.stringify(tags);
      let cell3 = me.doc.createElement('td');
      cell3.innerHTML = score + " | " + frecency;
      let cell4 = me.doc.createElement('td');
      cell4.appendChild(bmImg);

      row.appendChild(cell);
      row.appendChild(cell2);
      row.appendChild(cell3);
      row.appendChild(cell4);
      $(type).appendChild(row);
    });
  }
  
  let showFail = true;
  if (me.results["bThT"].length > 0) {
    populate(me.results["bThT"], "bThT");
    showFail = false;
  }
  if (me.results["bThF"].length > 0) {
    populate(me.results["bThF"], "bThF");
    showFail = false;
  }
  if (showFail) {
    let h1 = me.doc.createElement('h1');
    h1.innerHTML = "awesomeTab returned no results. You dont seem to have bookmarks with relevant tags.";
    $('no-results').appendChild(h1);
    $('no-results').style.display = 'block';
  }
};

