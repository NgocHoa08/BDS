(function () {
  if (typeof window === 'undefined' || !window.FBInstant) return;
  var host = '';
  try {
    host = (window.location.hostname || '').toLowerCase();
  } catch (e) {}
  var embedded = false;
  try {
    embedded = window.parent !== window;
  } catch (e) {
    embedded = true;
  }
  if (!embedded && host.indexOf('fbsbx.com') === -1 && host.indexOf('facebook.com') === -1) {
    return;
  }

  function safeProgress(pct) {
    try {
      if (window.FBInstant && typeof window.FBInstant.setLoadingProgress === 'function') {
        window.FBInstant.setLoadingProgress(pct);
      }
    } catch (e) {}
  }

  function waitDomReady() {
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        resolve();
      }
      if (document.readyState === 'interactive' || document.readyState === 'complete') {
        setTimeout(finish, 80);
      } else {
        document.addEventListener('DOMContentLoaded', function () {
          setTimeout(finish, 80);
        }, { once: true });
        setTimeout(finish, 1500);
      }
    });
  }

  window.__FB_START_PROMISE__ = window.FBInstant.initializeAsync()
    .then(function () {
      safeProgress(50);
      return waitDomReady();
    })
    .then(function () {
      safeProgress(100);
      return window.FBInstant.startGameAsync();
    })
    .then(function () {
      window.__FB_STARTED__ = true;
      return true;
    })
    .catch(function (err) {
      console.error('[FBInstant boot error]', err);
      // Fallback retry in case setLoadingProgress / startGameAsync hit a transient timing race
      try {
        safeProgress(100);
        return window.FBInstant.startGameAsync()
          .then(function () {
            window.__FB_STARTED__ = true;
            return true;
          })
          .catch(function () {
            return false;
          });
      } catch (e2) {
        return false;
      }
    });
})();
