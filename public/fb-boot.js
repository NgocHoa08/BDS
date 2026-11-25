(function () {
  if (typeof window === 'undefined' || !window.FBInstant) return;
  try {
    var host = (window.location.hostname || '').toLowerCase();
    var embedded = false;
    try {
      embedded = window.parent !== window;
    } catch (e) {
      embedded = true;
    }
    if (!embedded && host.indexOf('fbsbx.com') === -1 && host.indexOf('facebook.com') === -1) {
      return;
    }
    window.__FB_INIT_PROMISE__ = window.FBInstant.initializeAsync().then(function () {
      try {
        window.FBInstant.setLoadingProgress(35);
      } catch (e) {
        // ignore
      }
      return true;
    });
  } catch (e) {
    // ignore outside Facebook Instant Games
  }
})();
