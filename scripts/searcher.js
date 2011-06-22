/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Predictive Newtab.
 *
 * The Initial Developer of the Original Code is The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Abhinav Sharma <asharma@mozilla.com>
 *   Edward Lee <edilee@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

function TabJumpSearch(utils) {
  let me = this;
  me.utils = utils;
}

TabJumpSearch.prototype.search = function(collectedPlaces, visiblePlaces) {
  reportError("searching for tab jumps");
  let me = this;
  if (collectedPlaces.length == 0) {
    return [];
  }
  let revHost = visiblePlaces[collectedPlaces[0]]["rev_host"];
  reportError("TAB JUMP HOST: " + revHost);
  let hostTable = me.getHostTable(revHost);
  let results = [];
  let N = me.getTotalVisits();
  for (let otherHost in hostTable) {
    spinQuery(PlacesUtils.history.DBConnection, {
      "query" : "SELECT * FROM moz_places WHERE rev_host = :otherHost AND title IS NOT NULL ORDER BY visit_count DESC LIMIT 1",
      "params" : {
        "otherHost" : otherHost,
      },
      "names" : ["id", "title", "url", "frecency"],
    }).forEach(function ({id, title, url, frecency}) {
      let n = me.getTotalVisitsToHost(otherHost);
      n = n ? n : 1; // 1 should never happen
      results.push({
        "placeId" : id,
        "title" : title,
        "url": url,
        "score" : hostTable[otherHost],
        "frecency" : frecency,
        "bookmarked": utils.isBookmarked(id),
        "engine" : "tab-jump",
        "hub": utils.siteCentral.isURLHub(url), // TODO
        "anno" : [],
      });
    });
  }
  return results.sort(function(a,b) {return b.score - a.score});
}

TabJumpSearch.prototype.getTotalVisitsToHost = function(otherHost) {
  let me = this;
  let qR = spinQuery(PlacesUtils.history.DBConnection, {
    "query" : "SELECT SUM(count) as n FROM moz_jump_tracker WHERE dst= :otherHost",
    "params" : {
      "otherHost" : otherHost,
    },
    "names" : ["n"],
  });
  return qR[0]["n"];
}

TabJumpSearch.prototype.getTotalVisits = function() {
  let me = this;
  let qR = spinQuery(PlacesUtils.history.DBConnection, {
    "query" : "SELECT SUM(count) as n FROM moz_jump_tracker",
    "params" : {},
    "names" : ["n"],
  });
  return qR[0]["n"];
}

TabJumpSearch.prototype.getHostTable = function(revHost) {
  let me = this;
  let hostTable = {};
  spinQuery(PlacesUtils.history.DBConnection, {
    "names": ["dst", "count"],
    "query" : "SELECT * FROM moz_jump_tracker WHERE src = :revHost LIMIT 15",
    "params": {
      "revHost" : revHost,
    },
  }).forEach(function ({dst, count}) {
    hostTable[dst] = count;
  });
  return hostTable;
}

function LinkJumpSearch(utils) {
  let me = this;
  me.utils = utils;
}

LinkJumpSearch.prototype.search = function(collectedPlaces, visiblePlaces) {
  reportError("searcing for link jumps");
  let me = this;
  if (collectedPlaces.length == 0) {
    return [];
  }
  reportError(J(visiblePlaces));
  reportError(J(collectedPlaces));
  let revHost = visiblePlaces[collectedPlaces[0]]["rev_host"];
  reportError("LINK JUMP HOST: " + revHost);
  let hostJumpTable = me.getLinkJumpTableForHost(revHost);
  let results = [];
  for (let i = 0; i < hostJumpTable.length; i++) {
    let otherHost = hostJumpTable[i]["endHost"];
    spinQuery(PlacesUtils.history.DBConnection, {
      "names": ["id", "title", "url", "frecency"],
      "query": "SELECT * FROM moz_places WHERE rev_host = :otherHost AND title is NOT NULL ORDER BY visit_count DESC LIMIT 1",
      "params": {"otherHost" : otherHost},
    }).forEach(function({id, title, url, frecency}){
      results.push({
        "placeId" : id,
        "title" : title,
        "url": url,
        "score" : hostJumpTable[i]["count"],
        "frecency" : frecency,
        "bookmarked": me.utils.isBookmarked(id),
        "engine" : "link-jump",
        "hub": true, //TODO
        "anno" : [],
      });
    });
  }
  return results;
}

LinkJumpSearch.prototype.getLinkJumpTableForHost = function(revHost) {
  let me = this;
  let jumpTable = me.utils.getLinkJumpTable();
  let newTable = [];
  for (let i = 0; i < jumpTable.length; i++) {
    if (jumpTable[i]["starthost"] != revHost)
      continue;
    if (i >= 10)
      break;
    reportError("PUSH: " + jumpTable[i]["starthost"]);
    newTable.push({
      "endHost" : jumpTable[i]["endhost"],
      "count"   : jumpTable[i]["count"],
    });
  }
  return newTable;
}



function FullSearch(utils) {
  let me = this;
  me.utils = utils;
  me.idfMap = {};
  me.tfMap = {};
} 

FullSearch.prototype.createIDFMap = function(tags) {
  reportError("creating full search idf");
  let me = this;
  let idfMap = {};

  /* find the number of documents, N */
  reportError("Finding N");
  reportError(PlacesUtils.history.DBConnection);
  let N = spinQuery(PlacesUtils.history.DBConnection, {
    "query" : "SELECT COUNT(1) AS N FROM moz_places",
    "params": {},
    "names" : ["N"]
  })[0]["N"];
  reportError("N2");
  for (let word in tags) {
    if (word in me.idfMap) {
      return;
    }
    let left = '% ' + word + '%';
    let right = '%' + word + ' %';
    let query = "SELECT COUNT(1) as n from moz_places " +
      "WHERE LOWER(title) = :word OR title LIKE :left " +
      "OR title LIKE :right";
    let result = spinQuery(PlacesUtils.history.DBConnection, {
      "query" : query,
      "params" : {
        "left" : left,
        "right": right,
        "word": word,
      },
      "names": ["n"]
    });
    let n = result[0]["n"];
    me.idfMap[word] = Math.log((N - n + 0.5)/(n +0.5));
  };
}

FullSearch.prototype.search = function(tags) {
  reportError("searching all history");
  let me = this;
  me.createIDFMap(tags);

  let wordSelections = [];
  let wordConditions = [];
  let rankSelection = [];
  let names = ["id", "title", "url", "frecency", "visit_count", "score", "rev_host", "last_visit_date"];
  let wordParams = {};
  
  let i = 0;
  for (let word in tags) {
    wordParams["left" + i] = '% ' + word + '%';
    wordParams["right" + i] = '%' + word + ' %';
    wordParams["exact" + i] = '%'+ word + '%';
    wordParams["word" + i] = word;
    wordParams["idf" + i] = me.idfMap[word];
    wordSelections.push("(title LIKE :left" + i +") OR (title LIKE :right" + i + ") OR " + 
      "(CASE LOWER(title) WHEN :word" + i + " THEN 1 ELSE 0 END) as word_" + i);
    wordConditions.push("title LIKE :exact" + i);
    rankSelection.push("(word_" + i + " * :idf" + i +")");
    i++;
  }
  /*
  let strictConditions =  null;
  let timeRange = 30;
  if (timeRange && timeRange != 0) {
    let t = new Date().getTime() * 1000;
    strictConditions = t + " - last_visit_date < (:timeRange * 24 * 60 * 60 * 1000 * 1000) AND last_visit_date IS NOT NULL"
    wordParams['timeRange'] = timeRange;
  }
  */

  let selections = wordSelections.join(' , ');
  let conditions = wordConditions.join(' OR ');
  let ranked = rankSelection.join(' + ') + " as score";
  let order = ' ORDER BY score DESC, frecency DESC LIMIT 10';
   /*
  if (strictConditions) {
    conditions = "(" + conditions + ") AND " + strictConditions;
  }
  */
  let baseTable = "(SELECT * FROM moz_places WHERE title is NOT NULL and url is NOT NULL ORDER BY frecency DESC LIMIT 1000)"
  let inner = "(SELECT id, title, url, frecency, rev_host, visit_count, last_visit_date," + selections + 
    " FROM " + baseTable + " WHERE " + conditions + ")";
  let query = "SELECT id, title, url, frecency, rev_host, visit_count,last_visit_date," + ranked + " FROM " + 
    inner + order;
  reportError(query);
  reportError(J(wordParams));
  reportError(J(names));
  let results = [];
  var qR = spinQuery(PlacesUtils.history.DBConnection, {
    "names": names,
    "params": wordParams,
    "query" : query,
  }).forEach(function ({id, title, url, frecency, rev_host, score}) {
    results.push({
      "placeId" : id,
      "title" : title,
      "url": url,
      "score" : score,
      "frecency" : frecency,
      "bookmarked": me.utils.isBookmarked(id),
      "engine" : "all",
      "hub": me.utils.siteCentral.isURLHub(url),
      "anno" : [],
    });
  });
  return results;
}

function BookmarkSearch(utils) {
  let me = this;
  me.utils = utils;
  me.rowid = me.getRowID();
  me.idfMap = {};
  me.tfMap = {};
}

BookmarkSearch.prototype.search = function(tags) {
  reportError("searching bookmarks" + J(tags));
  let me = this;
  me.createIDFMap(tags);

  let condition = [];
  let i = 0;
  let params = {};
  for (let tag in tags) {
    condition.push("title = :tag" + i);
    params["tag" + i] = tag;
    i++;
  }

  /* no tags to search for, or db does not have any record of tags (unexpected)*/
  if (condition.length == 0 || !me.rowid) {
    return [];
  }
  condition = condition.join(' OR ');
  params["rowid"] = me.rowid;
  let seenPlaces = {};
  let query = "SELECT p.id as id, p.title as title,  p.url as url, " +
    "p.frecency as frecency, p.rev_host as rev_host, " +
    "GROUP_CONCAT(tag) as tags, COUNT(1) as matches FROM " +
    "(SELECT t.title as tag, b.fk as place_id FROM " +
    "(SELECT * FROM moz_bookmarks WHERE parent = :rowid AND (" + condition + ")) t JOIN " +
    "(SELECT * FROM moz_bookmarks WHERE type=1) b ON b.parent=t.id) r JOIN " +
    "moz_places p ON p.id=r.place_id GROUP BY p.id ORDER BY matches DESC, frecency DESC LIMIT 10";
  let results = [];
  reportError(query);
  reportError(J(params));
  spinQuery(PlacesUtils.history.DBConnection, {
    "query" : query,
    "params" : params,
    "names" : ["id", "tags", "url", "title", "frecency", "rev_host"],
  }).forEach(function({id, tags, url, title, frecency, rev_host}) {
    reportError("BOOOKMARK RESULT");
    results.push({
      "placeId" : id,
      "title" : title,
      "url": url,
      "score" : tags.split(',').map(function(tag) {
                  return me.idfMap[tag];
                }).reduce(function (a,b) {
                  return a + b;
                }),
      "frecency" : frecency,
      "bookmarked": true,
      "engine" : "bm",
      "hub": true, //TODO
      "anno" : tags,
    });
  });
  return results;
}

BookmarkSearch.prototype.getRowID = function() {
  let me = this;
  return spinQuery(PlacesUtils.history.DBConnection, {
    "query" : "SELECT rowid FROM moz_bookmarks_roots WHERE root_name = 'tags';",
    "params" : {},
    "names" : ["rowid"],
  })[0]["rowid"];
}

BookmarkSearch.prototype.createIDFMap = function(tags) {
  let me = this;
  let N = spinQuery(PlacesUtils.history.DBConnection, {
    "query" : "SELECT COUNT(1) as N FROM moz_bookmarks WHERE parent = :rowid",
    "params"  : {"rowid" : me.rowid},
    "names" : ["N"],
  })[0]["N"];
  for (let tag in tags) {
    let n = spinQuery(PlacesUtils.history.DBConnection, {
      "query" : "SELECT COUNT(1) as n FROM " +
        "(SELECT * FROM moz_bookmarks WHERE parent= :rowid AND title= :tag) s " +
        "JOIN moz_bookmarks b on s.id = b.parent",
      "params" : {
        "rowid" : me.rowid,
        "tag": tag,
      },
      "names" : ["n"]})[0]["n"];
    me.idfMap[tag] = Math.log((N - n + 0.5)/(n + 0.5));
    me.tfMap[tag] = 1;
  }
}
