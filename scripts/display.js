function Display(places, doc) {

  let $ = doc.getElementById;
  let type = null;
  for (let i = 0; i < places.length; i++) {
    let place = places[i];
    reportError(J(place));
    let title = place.title, 
        score = place.score, 
        frecency = place.frecency, 
        bookmarked = place.bookmarked,
        url = place.url,
        hub = place.hub,
        tags = place.tags;
    
    if (!title || !url) {
      continue;
    }

    if (hub) {
      $('bThT-table').style.display = "block";
      type = 'bThT';
    } else {
      $('bThF-table').style.display = "block";
      type = 'bThF';
    }

    let bmImg = doc.createElement('img');
    bmImg.style.height = '16px';
    bmImg.style.width = '16px';
    bmImg.src = 'img/star.png';
    bmImg.style.visibility = place["bookmarked"] ? 'visible' : 'hidden';

    let link = doc.createElement('a');
    link.setAttribute('href', url);

    link.innerHTML = title.slice(0,35);
    let urlText = doc.createElement('span');
    urlText.innerHTML = '(' + url.slice(0,33) + ')';

    let row = doc.createElement('tr');
    let cell = doc.createElement('td');
    cell.appendChild(link);
    cell.appendChild(doc.createElement('br'));
    cell.appendChild(urlText);
    let cell2 = doc.createElement('td');
    cell2.innerHTML = JSON.stringify(tags);
    let cell3 = doc.createElement('td');
    cell3.innerHTML = score + " | " + frecency;
    let cell4 = doc.createElement('td');
    cell4.appendChild(bmImg);

    row.appendChild(cell);
    row.appendChild(cell2);
    row.appendChild(cell3);
    row.appendChild(cell4);
    $(type).appendChild(row);

  }

  if (!type) {
    $('no-results').style.display = "block";
  }
}
