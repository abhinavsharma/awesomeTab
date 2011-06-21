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



function JumpTracker() {
  let me = this;
  me.buffer = [];
}

JumpTracker.prototype.getPrevHostFromURL = function(url) {
  let me = this;
  let result = spinQuery(PlacesUtils.history.DBConnection, {
    "query" : "select from_visit from (select id from moz_places  WHERE url = :url) "  + 
      "p JOIN moz_historyvisits h on p.id = h.place_id ORDER BY h.id DESC LIMIT 1",
    "params" : {"url" : url},
    "names" : ["from_visit"],
  })
  
  for (let i = 0; i < result.length; i++) {
    let from_visit = result[i].from_visit;
    if (from_visit == 0) {
      return null;
    } else {
      let inner = spinQuery(PlacesUtils.history.DBConnection, {
        "query" : "SELECT p.rev_host as rev_host FROM " + 
          "(SELECT place_id FROM moz_historyvisits WHERE id = :id) h " +
          "JOIN moz_places p ON p.id = h.place_id",
        "names": ["rev_host"],
        "params": {"id" : from_visit},
      })
      
      for (let j = 0; j < inner.length; j++) {
        let rev_host = inner[i].rev_host;
        return rev_host;
      };
      return null
    }
  }
  return null;
}

JumpTracker.prototype.addPair = function(start, end) {
  let me = this;
  if (start == end) {
    return;
  }
  reportError("ADDING PAIR: " + start + "|" + end);
  let existing = spinQuery(PlacesUtils.history.DBConnection, {
    "query": "SELECT COUNT(1) as c FROM moz_jump_tracker WHERE src = :src AND dst = :dst AND type = 1",
    "names": ["c"],
    "params": {
      "src" : start,
      "dst" : end,
    },
  });
  if (existing[0]["c"] > 0) {
    reportError("updating");
    spinQuery(PlacesUtils.history.DBConnection, {
      "query": "UPDATE moz_jump_tracker SET count = count + 1 WHERE src = :src AND dst = :dst",
      "params": {
        "src" : start,
        "dst" : end,
      },
      "names": [],
    });
  } else {
    reportError("inserting");
    spinQuery(PlacesUtils.history.DBConnection, {
      "query": "INSERT INTO moz_jump_tracker (src, dst, count, type) VALUES (:src, :dst, :count, 1);",
      "params": {
        "src" : start,
        "dst" : end,
        "count" : 1,
      },
      "names": [],
    });

  }
}

JumpTracker.prototype.addPageLoad = function(url) {
  let me = this;
  if (!url) {
    return;
  }
  let prevHost = me.getPrevHostFromURL(url);
  if (!prevHost) {
    return;
  } else {
    let currentHost = null;
    me.addPair(prevHost, currentHost);
    me.buffer = []; // tab behavior rendered useless

    // TODO: make use of last active tab
  }
}

JumpTracker.prototype.addTabChange = function(url) {
  let me = this;
  if (url && (/^https{0,1}:\/\//).test(url)) {
    let result = spinQuery(PlacesUtils.history.DBConnection, {
      "query" : "SELECT rev_host FROM moz_places where url = :url",
      "params" : {"url": url},
      "names": ["rev_host"],
    });
    reportError(J(result));
    if (result.length == 0) {
      // weird, url is valid but no place id.
      reportError("url but no place");
    } else {
      me.buffer.push(result[0].rev_host);
      me.flushBuffer();
    }
  } else {
    me.buffer = [];
  }
}

JumpTracker.prototype.flushBuffer = function() {
  let me = this;
  if (me.buffer.length < 2) {
    return;
  }
  for (let i = 0; i < me.buffer.length - 1; i++) {
    let start = me.buffer[i], end = me.buffer[i+1];
    me.addPair(start, end);
  }
  me.buffer = [me.buffer[me.buffer.length - 1]];
}

function LinkJumper() {
  let me = this;
  let jumpTable = me.getJumpTable();
  me.jumpList = {};
  for (let i = 0; i < jumpTable.length; i++) {
    let row = jumpTable[i];
    let startHost = row.starthost,
        endHost = row.endhost,
        count = row.count;
    if (startHost in me.jumpList) {
      me.jumpList[startHost].push([endHost, count]);
    } else {
      me.jumpList[startHost] = [[endHost, count]];
    }
  }
  reportError(J(me.jumpList));
}

LinkJumper.prototype.getJumpTable = function () {
  let query = "SELECT p1.rev_host as starthost, p2.rev_host as endhost, COUNT(1) as count FROM (SELECT h.place_id as st, dst.place_id as end FROM (SELECT * FROM moz_historyvisits WHERE (visit_type = 1 OR visit_type = 5) AND from_visit != 0 ORDER BY id desc) dst JOIN moz_historyvisits h on dst.from_visit = h.id GROUP BY st, end) path JOIN moz_places p1 on path.st = p1.id join moz_places p2 on p2.id = path.end WHERE starthost != endhost GROUP BY starthost, endhost ORDER by count DESC";
  return spinQuery(PlacesUtils.history.DBConnection, {
    "query" : query,
    "params" : {},
    "names" : ["starthost", "endhost", "count"],
  });
}

LinkJumper.prototype.getDestinationHosts = function(revHost) {
  let me = this;
  reportError("jump list for : " + revHost);
  reportError("jump table is " + J(me.jumpList));
  return (revHost in me.jumpList) ? me.jumpList[revHost] : [];
}

function LinkJumpSuggest() {
  let me = this;
  let linkJumper = new LinkJumper();
  me.jumpTable = linkJumper.getJumpTable();
}


