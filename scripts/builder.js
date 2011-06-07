function Builder(rankedResults, doc, utils) {
  let me = this;
  me.doc = doc;
  me.utils = utils;
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
    if (place.bookmarked && place.hub) {
      me.results["bThT"].push([placeId, score, tags]);
    } else if (place.bookmarked && !place.hub) {
      me.results["bThF"].push([placeId, score, tags]);
    } else if (!place.bookmarked && place.hub) {
      me.results["bFhT"].push([placeId, score, tags]);
    } else {
      me.results["bFhF"].push([placeId, score, tags]);
    }
  };

  for (let k in me.results) {
    me.results[k] = me.results[k].sort(function(a,b) {
      return b[1] - a[1];
    });
  }
}

Builder.prototype.show = function() {
  let me = this;
  reportError(JSON.stringify(me.results));
  let $ = me.doc.getElementById;

  function populate(results, type) {
    $(type + '-table').style.display = "block";
    results.forEach(function (a) {
      let placeId = a[0];
      let score = a[1];
      let tags = a[2].map(function(d){return d[0]});

      let placeInfo = me.utils.getData(["url", "title"], {"id":placeId}, "moz_places");
      if (!placeInfo || placeInfo.length == 0 || !(placeInfo = placeInfo[0]) || !placeInfo["title"] || !placeInfo["url"]) {
        reportError("fail " + JSON.stringify(placeInfo));
        return;
      }
      let img = me.doc.createElement('img');
      img.style.height = '16px';
      img.style.width = '16px';
      img.style.paddingRight = '4px';
      img.src = PlacesUtils.favicons.getFaviconImageForPage(Utils.makeURI(placeInfo["url"])).spec;

      let link = me.doc.createElement('a');
      link.setAttribute('href', placeInfo["url"]);
      link.innerHTML = placeInfo["title"];


      let row = me.doc.createElement('tr');
      let cell = me.doc.createElement('td');
      cell.appendChild(link);
      let cell2 = me.doc.createElement('td');
      cell2.innerHTML = JSON.stringify(tags);
      let cell3 = me.doc.createElement('td');
      cell3.innerHTML = score;


      row.appendChild(cell);
      row.appendChild(cell2);
      row.appendChild(cell3);
      $(type).appendChild(row);
    });
  }

  if (me.results["bThT"].length > 0) {
    populate(me.results["bThT"], "bThT");
  }
  if (me.results["bThF"].length > 0) {
    populate(me.results["bThF"], "bThF");
  }
};

