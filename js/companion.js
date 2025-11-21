// companion.js
(function(){
  const patientsApi = window.eseb && window.eseb.patients;
  const modals = window.eseb && window.eseb.modals;
  const utils = window.eseb && window.eseb.utils;
  if(!patientsApi || !modals || !utils) throw new Error('patients, modals and utils must be loaded before companion.js');

  const panelCompanion = document.getElementById('panel-companion');
  const formCompanion = document.getElementById('form-companion');
  const compInput = document.getElementById('comp-code');

  function showCompanionInModal(code){
    const p = patientsApi.findByPublicCode(code);
    if(!p){
      modals.openCompanionContent(`<div><h3>Código no encontrado</h3><p class="muted">El código ingresado no corresponde a ningún paciente.</p><div style="margin-top:12px"><button class="btn ghost" id="btn-close-companion-view">Cerrar</button></div></div>`);
      // attach close inside modal (delegated)
      setTimeout(()=> {
        const btn = document.getElementById('btn-close-companion-view');
        if(btn) btn.addEventListener('click', ()=> modals.closeModalLarge());
      }, 10);
      return;
    }

    let html = `<div><h3>${utils.escapeHtml(p.name)}</h3>
      <div class="detail-grid">
        <div class="kv"><strong>Motivo</strong><div class="muted">${utils.escapeHtml(p.reason || '-')}</div></div>
        <div class="kv"><strong>Teléfono</strong><div class="muted">${utils.escapeHtml(p.phone || '-')}</div></div>
        <div class="kv"><strong>Llegada</strong><div class="muted">${p.arrived ? 'Confirmada '+ new Date(p.arrivedAt).toLocaleString() : 'Pendiente'}</div></div>
        <div class="kv"><strong>Hab / Camilla</strong><div class="muted">${utils.escapeHtml(p.assignedRoom || '-') } / ${utils.escapeHtml(p.assignedBed || '-')}</div></div>
        <div class="kv"><strong>Atiende</strong><div class="muted">${utils.escapeHtml(p.attending || '-')}</div></div>
      </div>
      <div class="timeline"><h4>Procedimientos (tiempo real)</h4>`;

    if(!p.shareWithCompanion){
      html += `<div class="muted">Los procedimientos son privados para este paciente. No están disponibles para acompañantes.</div>`;
    } else {
      if(!p.procedures || p.procedures.length === 0){
        html += `<div class="muted">Sin procedimientos registrados</div>`;
      } else {
        p.procedures.forEach(pr=>{
          html += `<div class="proc"><div><strong>${utils.escapeHtml(pr.desc)}</strong><br><small>${utils.escapeHtml(pr.performedBy || '---')} · ${new Date(pr.time).toLocaleString()}</small></div></div>`;
        });
      }
    }

    html += `</div><div style="margin-top:12px"><button class="btn ghost" id="btn-close-companion-view">Cerrar</button></div></div>`;
    modals.openCompanionContent(html);

    // bind close
    setTimeout(()=> {
      const btn = document.getElementById('btn-close-companion-view');
      if(btn) btn.addEventListener('click', ()=> modals.closeModalLarge());
    }, 10);
  }

  // ensure companion form uses modal and clears input on close
  if(formCompanion){
    formCompanion.addEventListener('submit', (ev)=>{
      ev.preventDefault();
      const code = (compInput && compInput.value) ? compInput.value.trim() : '';
      if(!code) return;
      showCompanionInModal(code);
    });
  }

  // open small panel logic
  const openCompanionBtn = document.getElementById('open-companion');
  const btnCloseCompanionSmall = document.getElementById('btn-close-companion');
  if(openCompanionBtn){
    openCompanionBtn.addEventListener('click', ()=>{
      if(panelCompanion) panelCompanion.classList.remove('hidden');
      if(compInput){ compInput.value = ''; compInput.focus(); }
    });
  }
  if(btnCloseCompanionSmall){
    btnCloseCompanionSmall.addEventListener('click', ()=>{
      if(panelCompanion) panelCompanion.classList.add('hidden');
      if(compInput) compInput.value = '';
    });
  }

  // when the modal (companion) is closed ensure the input is cleared (for security)
  window.addEventListener('eseb:storage', ()=> {
    // no-op: placeholder if we later want to react to storage changes
  });

  window.eseb = window.eseb || {};
  window.eseb.companion = {
    showCompanionInModal
  };
})();
