(function(){
  // Simple lightbox for gallery images
  function qs(sel,ctx){return (ctx||document).querySelector(sel)}
  function qsa(sel,ctx){return Array.from((ctx||document).querySelectorAll(sel))}

  const modal = qs('#hmLightbox');
  const modalImg = qs('#hmLightbox .hm-modal-content img');
  const closeBtn = qs('#hmLightboxClose');

  function open(src, alt){
    modalImg.src = src;
    modalImg.alt = alt || '';
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function close(){
    modal.classList.remove('show');
    modalImg.src = '';
    document.body.style.overflow = '';
  }

  // Attach click listeners to gallery thumbnails (images inside .hm-gallery-item)
  qsa('.hm-gallery-item img, .hm-gallery-thumb-link img').forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', function(e){
      e.preventDefault();
      open(img.src, img.alt);
    });
  });

  // Also allow links that wrap items to open the image instead of following link
  qsa('a.hm-gallery-thumb-link').forEach(a => {
    a.addEventListener('click', function(e){
      const img = a.querySelector('img');
      if(img){ e.preventDefault(); open(img.src, img.alt); }
    });
  });

  // Close handlers
  closeBtn && closeBtn.addEventListener('click', close);
  modal && modal.addEventListener('click', function(e){ if(e.target === modal) close(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') close(); });
})();
