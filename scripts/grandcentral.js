function SiteCentral() {
  let me = this;
  me.utils = new AwesomeTabUtils();
  me.re_bad_substrings = new RegExp(/(\/post\/|\/article\/)/g);
  me.re_is_num = new RegExp(/\/[0-9]+\/{0,1}$/);
  me.re_bad_param = new RegExp(/^([a-z]|search)=/);
}

SiteCentral.prototype.isHub = function(placeId) {
  let me = this;
  let data = me.utils.getData(["url"], {"id":placeId},"moz_places");
  if (data.length == 0 || !data[0]["url"]) {
    return false;
  } else {
    return me.isURLHub(data[0]["url"]);
  }
}

/*
 * some heuristics, goal is to reject something very unlikely
 * to be a hub quickly.
 */
SiteCentral.prototype.isURLHub = function(url) {
  let me = this;
  if (!url) {
    return false;
  }
  url = url.split('?');
  if (url.length > 1) {
    if (me.re_bad_param.test(url[1])){
      return false;
    }
  }

  if (RE_HOME_URL.test(url)) {
    return true;
  }

  url = url[0];
  let splitURL = url.split('/');

  
  /* Quick reject */
  if (url.length > 80) { // very unlikely to be a hub
    reportError(url + "TOO LONG");
    return false
  }
  
  if (RE_FAIL_URL.test(url)) {
    return false;
  }

  let r1 = url.match(/[0-9]+/g);
  if (r1 && !r1.reduce(function(p,c,i,a) {
        return (p && (c.length < 6))
      }, true)) {
    reportError(url + "more than 8 consecutive digits");
    return false; // if after removing slash, more than 8 consec digits
  }
  if (splitURL.length > 7) {
    reportError(url + "has too many slashes");
    return false; // craziest i've seen is https://www.amazon.com/gp/dmusic/mp3/player
  }
  
  if (!splitURL.reduce(function(p,c){
        return (p && c.length < 40 && c.split(/[\-\_]/g).length < 3);
      }, true)) {
    reportError(url + "has component over 40 chars");
    return false;
  }
  return true;
}

SiteCentral.prototype.hubMapForHosts = function(hosts) {
  let me = this;
  let sqlQuery = "SELECT id, visit_count FROM (SELECT AVG(visit_count) " + 
    "as a FROM moz_places WHERE :condition) avg INNER JOIN " + 
    "(SELECT * FROM moz_places WHERE :condition) " + 
    "p ON p.visit_count > 5 * avg.a";
  let params = {
    condition : hosts.map(function(s) { return "rev_host = " + s}).join(' OR '),
  }
  me.hubMap = {};
  me.utils.getDataQuery(sqlQuery, params, ["id"]).forEach(function({id, visit_count}) {
    me.hubMap[id] = visit_count;
  });
  reportError(JSON.stringify(me.hubMap));
}

SiteCentral.prototype.isHubFromMap = function(placeId) {
  let me = this;
  return (placeId in me.hubMap);
}

function SessionCentral() {
  let me = this;
}

/*
 * urlMap is assumed to have a {rev_host -> url structure;}
 */
function GrandCentral(urlMap, avgMap) {
  let me = this;
  me.trieMap = {};
  me.placeMap = {};
  me.hostMap = {};
  me.avgMap = avgMap;
  for (let revHost in urlMap) {
    me.trieMap[revHost] = new URLTrie(urlMap[revHost], revHost, me);
    me.trieMap[revHost].processTrie();
  }
}

GrandCentral.prototype.isHub = function(placeId) {
  let me = this;
  let revHost = me.hostMap[placeId];
  let url = me.placeMap[placeId];
  return me.trieMap[revHost].isHub(url)
};

function URLTrie(urls, revHost,  central) {
  let me = this;
  me.splitMap = {};
  me.central = central;
  me.revHost = revHost;
  me.trie = {
    "v" : 0,
    "c" : {},
    "p" : null,
  };
  me.nodeList = [];

  for (let i = 0; i < urls.length; i++) {
    central.placeMap[urls[i]["id"]] = urls[i]["url"];
    central.hostMap[urls[i]["id"]] = revHost;
    me.addURL(urls[i]["url"], urls[i]["visit_count"]);
  }
  reportError(J(me.nodeList));
  reportError(J(me.trie));
  me.processTrie();
  reportError(J(me.trie));
}

URLTrie.prototype.addURL = function(url, visitCount) {
  let me = this;
  let split = url.split(/(https{0,1}:\/\/)|(\/)|(\/{0,1}#\/{0,1})/)
    .slice(4).filter(function (s) {
      return (s && !(/^\/|#/).test(s));
    });
  let current = me.trie;
  me.splitMap[url] = split;
  let len = split.length;
  for (let i = 0; i < len; i++) {
    let str = split[i];
    if (str in current.c) {
      current = current.c[str];
    } else {
      current.c[str] = {
        "v" : (i == len - 1 ? visitCount : 0),
        "c" : {},
      };
      current = current.c[str];
      me.nodeList.push(current);
    }
  }
}

/*
 * Algorithm to process the trie and determine which nodes are hubs.
 */
URLTrie.prototype.processTrie = function() {
  let me = this;
  let current = me.trie.c;
  
  function hubbleBubble(node) {
    let children = node.c, total = 0, n = 0;
    let hasChildren = false;
    for (let child in node.c) {
      hasChildren = true;
      total += node.c[child].v;
      n += 1;
    }
    reportError("stats: current - " + node.v + "avg: " + total + "/"+n + "hasc: " + hasChildren);
    if (hasChildren && total/n < node.v) {
      node.h = true;
    } else if (!hasChildren) {
      node.h = (node.v > 5 * me.central.avgMap[me.revHost]); // TODO: think
    } else {
      node.h = false;
    }
  }
  reportError(me.nodeList.length);
  for (let i = 0; i < me.nodeList.length; i++) {
    hubbleBubble(me.nodeList[i]);
  }
    
};

URLTrie.prototype.isHub = function(url) {
  let me = this;
  let split = me.splitMap[url];
  let current = me.trie;
  let isHub = false;
  let current = me.trie.c;

  /* traverse trie to evaluted node and pick up if its a host */
  for (let i = 0; i < split.length; i++) {
    if (split[i] in current) {
      isHub = current[split[i]]["h"];
      current = current[split[i]]["c"];
    }
  }
  return isHub;
}
