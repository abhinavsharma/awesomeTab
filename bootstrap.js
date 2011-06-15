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
 * The Original Code is Restartless.
 *
 * The Initial Developer of the Original Code is The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    Abhinav Sharma <asharma@mozilla.com>
 *    Edward Lee <edilee@mozilla.com>
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

/* alias for quick access */
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

/* imports */
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/PlacesUtils.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

/* Javascript files to import from scripts/ */
AWESOMETAB_SCRIPTS = [
  "awesometab",
  "thumbnail",
  "utils",
  "collector",
  "grandcentral",
  "allsearch",
  "stop",
  "bmsearch",
  "pos",
  "mixer",
  "display",
  "tester",
];

const global = this;
global.isInit = false;

const DEBUG = true;
const SHOWNICE = false;
const TESTER = true;
const reportError = DEBUG ? Cu.reportError : function() {};
const J = DEBUG ? JSON.stringify : function() {return ""};


/* some useful regular expressions */
RE_NOUN_VERB = new RegExp(/(^NN)|(^VB)|(^JJ)/);

/*http{s}://<anything goes here>{/} types of URLs are good */
RE_HOME_URL = new RegExp(/^https{0,1}:\/\/[a-zA-Z0-9\.\-\_]+\/{0,1}$/);

/*
 * 1. has an unacceptable substring like /post/ or /article/
 * 2. ends with a number like bla.com/2/ or bla.com/2
 * 3. has 8 or more consecutive numbers, ignoring slashes
 */
RE_FAIL_URL = new RegExp(/(\/post\/|\/article\/)|([\/#][0-9]+\/{0,1}$)|((\/*[0-9]){8,})/)

/**
 * Apply a callback to each open and new browser windows.
 *
 * @usage watchWindows(callback): Apply a callback to each browser window.
 * @param [function] callback: 1-parameter function that gets a browser window.
 */
function watchWindows(callback) {
  // Wrap the callback in a function that ignores failures
  function watcher(window) {
    try {
      // Now that the window has loaded, only handle browser windows
      let {documentElement} = window.document;
      if (documentElement.getAttribute("windowtype") == "navigator:browser")
        callback(window);
    }
    catch(ex) {}
  }

  // Wait for the window to finish loading before running the callback
  function runOnLoad(window) {
    // Listen for one load event before checking the window type
    window.addEventListener("load", function runOnce() {
      window.removeEventListener("load", runOnce, false);
      watcher(window);
    }, false);
  }

  // Add functionality to existing windows
  let windows = Services.wm.getEnumerator(null);
  while (windows.hasMoreElements()) {
    // Only run the watcher immediately if the window is completely loaded
    let window = windows.getNext();
    if (window.document.readyState == "complete")
      watcher(window);
    // Wait for the window to load before continuing
    else
      runOnLoad(window);
  }

  // Watch for new browser windows opening then wait for it to load
  function windowWatcher(subject, topic) {
    if (topic == "domwindowopened")
      runOnLoad(subject);
  }
  Services.ww.registerNotification(windowWatcher);

  // Make sure to stop watching for windows if we're unloading
  unload(function() Services.ww.unregisterNotification(windowWatcher));
}

/**
 * Save callbacks to run when unloading. Optionally scope the callback to a
 * container, e.g., window. Provide a way to run all the callbacks.
 *
 * @usage unload(): Run all callbacks and release them.
 *
 * @usage unload(callback): Add a callback to run on unload.
 * @param [function] callback: 0-parameter function to call on unload.
 * @return [function]: A 0-parameter function that undoes adding the callback.
 *
 * @usage unload(callback, container) Add a scoped callback to run on unload.
 * @param [function] callback: 0-parameter function to call on unload.
 * @param [node] container: Remove the callback when this container unloads.
 * @return [function]: A 0-parameter function that undoes adding the callback.
 */
function unload(callback, container) {
  // Initialize the array of unloaders on the first usage
  let unloaders = unload.unloaders;
  if (unloaders == null)
    unloaders = unload.unloaders = [];

  // Calling with no arguments runs all the unloader callbacks
  if (callback == null) {
    unloaders.slice().forEach(function(unloader) unloader());
    unloaders.length = 0;
    return;
  }

  // The callback is bound to the lifetime of the container if we have one
  if (container != null) {
    // Remove the unloader when the container unloads
    container.addEventListener("unload", removeUnloader, false);

    // Wrap the callback to additionally remove the unload listener
    let origCallback = callback;
    callback = function() {
      container.removeEventListener("unload", removeUnloader, false);
      origCallback();
    }
  }

  // Wrap the callback in a function that ignores failures
  function unloader() {
    try {
      callback();
    }
    catch(ex) {}
  }
  unloaders.push(unloader);

  // Provide a way to remove the unloader
  function removeUnloader() {
    let index = unloaders.indexOf(unloader);
    if (index != -1)
      unloaders.splice(index, 1);
  }
  return removeUnloader;
}

function handlePageLoad(e) {
  reportError("Handling a page load");
  global.thumbnailer.handlePageLoad(e);
}

function handleTabSelect(e) {
  let url = e.originalTarget.linkedBrowser.contentDocument.location.href;
  if (url && (/^http:\/\//).test(url)) {
    global.lastURL = url;
  }
}

/**
 * Shift the window's main browser content down and right a bit
 */
function setupListener(window) {
Cu.reportError("setup listener");

  window.addEventListener("DOMContentLoaded", handlePageLoad, true);
  let gB = Services.wm.getMostRecentWindow("navigator:browser").gBrowser;
  gB.tabContainer.addEventListener("TabSelect", handleTabSelect, false)

  function change(obj, prop, val) {
    let orig = obj[prop];
    obj[prop] = typeof val == "function" ? val(orig) : val;
    unload(function() obj[prop] = orig, window);
  }
    
  change(window.gBrowser, "loadOneTab", function(orig) {
    return function(url) {
      let tab = orig.apply(this, arguments);
      if (url == "about:blank") {
        let gBrowser = Services.wm.getMostRecentWindow("navigator:browser").gBrowser;
        let fileURI = global.aboutURI.resolve('');
        let tBrowser = gBrowser.getBrowserForTab(tab)
        tBrowser.loadURI(fileURI, null, null);
       
        tab.linkedBrowser.addEventListener("load", function() {
          tab.linkedBrowser.removeEventListener("load", arguments.callee, true);
          Services.wm.getMostRecentWindow("navigator:browser").gURLBar.value = "";
          let doc = tab.linkedBrowser.contentDocument;
          let dashboard = new AwesomeTab(doc, global.utils, global.central, global.tagger, global.thumbnailer.getAnnoID());
        }, true);

      }
      return tab;
    };
  });
  
  unload(function() {
    window.removeEventListener("DOMContentLoaded", handlePageLoad, true);
    gB.removeEventListener("TabSelect", handleTabSelect, true);
  }, window);
}

/**
 * Handle the add-on being activated on install/enable
 */
function startup(data, reason) {
  globalInit(data.id);
}

function globalInit(id) {
  if (!global.isInit) {
    AddonManager.getAddonByID(id, function(addon) {
      // XXX Force a QI until bug 609139 is fixed
      PlacesUtils.history.QueryInterface(Ci.nsPIPlacesDatabase);

      /* import scripts */
      AWESOMETAB_SCRIPTS.forEach(function(fileName) {
        let fileURI = addon.getResourceURI("scripts/" + fileName + ".js");
        Services.scriptloader.loadSubScript(fileURI.spec, global);
      });
      global.aboutURI = !SHOWNICE ? addon.getResourceURI("content/awesometab.html") : addon.getResourceURI("content/dial.html");
      global.central = new SiteCentral();
      global.tagger = new POSTagger();
      global.utils = new AwesomeTabUtils();
      global.thumbnailer = global.thumbnailer ? global.thumbnaler : new Thumbnailer();
      watchWindows(setupListener);
    }); 
  }
  global.isInit = true;

}


/**
 * Handle the add-on being deactivated on uninstall/disable
 */
function shutdown(data, reason) {
  // Clean up with unloaders when we're deactivating
  if (reason != APP_SHUTDOWN)
    unload();
}

/**
 * Handle the add-on being installed
 */
function install(data, reason) {
}

/**
 * Handle the add-on being uninstalled
 */
function uninstall(data, reason) {}
