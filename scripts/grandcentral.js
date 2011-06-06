function SiteCentral() {
  let me = this;
  me.utils = new AwesomeTabUtils();
}

SiteCentral.prototype.isHub = function(placeId) {
  return true;
}


function SessionCentral() {
  let me = this;
}
