function NewTab(doc, openURIs) {
  let me = this;
  reportError("Hello NewTab");
  reportError("open uris are" + openURIs);
  me.utils = new NewtabUtils();
  me.setupNewtab();
}

NewTab.prototype.setupNewtab = function() {

};

NewTab.prototype.populateNewtab = function() {
  
};
