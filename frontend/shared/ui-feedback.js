(function () {
  function ensureLayer() {
    var layer = document.getElementById('ui-toast-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'ui-toast-layer';
      layer.style.position = 'fixed';
      layer.style.top = '22px';
      layer.style.right = '22px';
      layer.style.zIndex = '99999';
      layer.style.display = 'flex';
      layer.style.flexDirection = 'column';
      layer.style.gap = '10px';
      document.body.appendChild(layer);
    }
    return layer;
  }

  function toast(message, type) {
    var layer = ensureLayer();
    var item = document.createElement('div');
    var bg = type === 'error' ? '#4b225f' : '#56308e';

    item.style.background = 'linear-gradient(135deg, ' + bg + ', #8e68ce)';
    item.style.color = '#fff';
    item.style.padding = '12px 14px';
    item.style.borderRadius = '12px';
    item.style.fontSize = '14px';
    item.style.maxWidth = '340px';
    item.style.boxShadow = '0 10px 26px rgba(45, 20, 72, 0.35)';
    item.style.opacity = '0';
    item.style.transform = 'translateY(-6px)';
    item.style.transition = 'all 160ms ease';
    item.textContent = message || 'Done';

    layer.appendChild(item);
    requestAnimationFrame(function () {
      item.style.opacity = '1';
      item.style.transform = 'translateY(0)';
    });

    setTimeout(function () {
      item.style.opacity = '0';
      item.style.transform = 'translateY(-6px)';
      setTimeout(function () {
        item.remove();
      }, 180);
    }, 2200);
  }

  window.showToast = toast;

  window.alert = function (message) {
    toast(message, 'error');
  };
})();
