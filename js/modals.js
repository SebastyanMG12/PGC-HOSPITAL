// modals.js
(function(){
  const utils = window.eseb && window.eseb.utils;
  if(!utils) throw new Error('utils.js must be loaded before modals.js');

  const modalRegistered = document.getElementById('modal-registered');
  const regCodeEl = document.getElementById('reg-code');
  const btnCloseRegistered = document.getElementById('btn-close-registered');

  const modalView = document.getElementById('modal-view');
  const modalViewContent = document.getElementById('modal-view-content');
  const btnCloseView = document.getElementById('btn-close-view');

  function openRegistered(code){
    if(!modalRegistered) return;
    if(regCodeEl) regCodeEl.textContent = code || '--';
    modalRegistered.classList.remove('hidden');
    modalRegistered.style.zIndex = '9998';
  }
  function closeRegistered(){
    if(!modalRegistered) return;
    modalRegistered.classList.add('hidden');
  }

  function openModalLarge(html){
    if(!modalView || !modalViewContent) return;
    modalViewContent.innerHTML = html || '';
    modalView.classList.remove('hidden');
    modalView.style.zIndex = '9999';
    // disable panel behind (if exists)
    const panel = document.getElementById('panel-staff');
    if(panel){
      panel.style.pointerEvents = 'none';
      panel.style.filter = 'blur(0.6px)';
    }
    // scroll to top
    modalViewContent.scrollTop = 0;
    const first = modalViewContent.querySelector('button, input, select, textarea, a');
    if(first) first.focus();
  }

  function closeModalLarge(){
    if(!modalView || !modalViewContent) return;
    modalView.classList.add('hidden');
    modalViewContent.innerHTML = '';
    const panel = document.getElementById('panel-staff');
    if(panel){
      panel.style.pointerEvents = '';
      panel.style.filter = '';
    }
    // clear companion input in page (security)
    const comp = document.getElementById('comp-code');
    if(comp) comp.value = '';
  }

  // small convenience to open companion content but ensure it clears after close
  function openCompanionContent(html){
    openModalLarge(html);
  }

  // wire close buttons if present
  if(btnCloseRegistered) btnCloseRegistered.addEventListener('click', ()=> closeRegistered());
  if(btnCloseView) btnCloseView.addEventListener('click', ()=> closeModalLarge());

  window.eseb = window.eseb || {};
  window.eseb.modals = {
    openRegistered,
    closeRegistered,
    openModalLarge,
    closeModalLarge,
    openCompanionContent
  };
})();
