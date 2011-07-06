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



function UserDisplay(searchResults, collectedHosts, doc, utils) {
  let me = this;
  me.doc = doc;
  me.utils = utils;
  let $ = me.doc.getElementById;
  let noResults = true;
  for (let type in searchResults) {
    for (let i in searchResults[type]) {
      if (searchResults[type][i].hub && !(searchResults[type][i].revHost in collectedHosts)) {
        noResults = false;
        $('wrapper-' + type).style.visibility = 'visible';
        if (!searchResults[type][i]["title"]) {
          continue;
        }
        let elem = me.getElementForResult(searchResults[type][i]);
        $('list-' + type).appendChild(elem);
      }
    }
  }
  if (noResults) {
    $('no-results').style.display = 'block';
  }
}

UserDisplay.prototype.getElementForResult = function(result) {
  let me = this;
  let e = me.doc.createElement('li');
  function escapeHTML(str) str.replace(/[&"<>]/g, function (m) "&" + ({ "&": "amp", '"': "quot", "<": "lt", ">": "gt" })[m] + ";");
  let f = me.doc.createElement('img');
  f.style.height = '16px';
  f.style.width = '16px';
  f.src = me.utils.getFaviconData(result.url);
  f.setAttribute("class", "favicon");
  let a = me.doc.createElement('a');
  a.setAttribute('href', result.url);
  a.textContent = result.title.length < 30 ? result.title : result.title.slice(0, 25) + " ...";
  e.appendChild(f);
  e.appendChild(a);
  return e;
}
