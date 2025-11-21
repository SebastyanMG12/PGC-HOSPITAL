// companion.js
(function(){
  const patientsApi = window.eseb && window.eseb.patients;
  const modals = window.eseb && window.eseb.modals;
  const utils = window.eseb && window.eseb.utils;
  if(!patientsApi || !modals || !utils) throw new Error('patients, modals and utils must be loaded before companion.js');

  const panelCompanion = document.getElementById('panel-companion');
  const formCompanion = document.getElementById('form-companion');
  const compInput = document.getElementById('comp-code');
  const modalView = document.getElementById('modal-view');

  // Código público actualmente mostrado en modal (si hay uno abierto)
  let currentShownCode = null;

  function buildStatusHtml(p){
    // Estado: Activo (si no hay dischargedAt) o Egresado (con fecha)
    if(p.dischargedAt){
      return `<div class="kv"><strong>Estado</strong><div class="muted">Egresado · ${new Date(p.dischargedAt).toLocaleString()}</div></div>`;
    } else {
      return `<div class="kv"><strong>Estado</strong><div class="muted">Activo</div></div>`;
    }
  }

  function showCompanionInModal(code){
    if(!code) return;
    const p = patientsApi.findByPublicCode(code);
    // set currently shown code for realtime updates
    currentShownCode = code;

    if(!p){
      modals.openCompanionContent(`<div><h3>Código no encontrado</h3><p class="muted">El código ingresado no corresponde a ningún paciente.</p><div style="margin-top:12px"><button class="btn ghost" id="btn-close-companion-view">Cerrar</button></div></div>`);
      // attach close handler
      setTimeout(()=> {
        const btn = document.getElementById('btn-close-companion-view');
        if(btn) btn.addEventListener('click', ()=> { modals.closeModalLarge(); currentShownCode = null; });
      }, 10);
      return;
    }

    let html = `<div><h3>${utils.escapeHtml(p.name)}</h3>
      <div class="detail-grid">
        <div class="kv"><strong>Motivo</strong><div class="muted">${utils.escapeHtml(p.reason || '-')}</div></div>
        <div class="kv"><strong>Teléfono</strong><div class="muted">${utils.escapeHtml(p.phone || '-')}</div></div>
        ${buildStatusHtml(p)}
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

    // open (replaces content if already open)
    modals.openCompanionContent(html);

    // wire close to clear currentShownCode
    setTimeout(()=> {
      const btn = document.getElementById('btn-close-companion-view');
      if(btn) btn.addEventListener('click', ()=> { modals.closeModalLarge(); currentShownCode = null; });
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

  // Real-time updates:
  // Cuando el paciente cambie (ej. se marca egreso) o se agregue/edite un procedimiento,
  // si el modal companion está abierto mostrando ese código, volver a renderizarlo.
  window.addEventListener('eseb:patient:updated', (ev)=>{
    try {
      if(!currentShownCode) return;
      if(modalView && modalView.classList.contains('hidden')) return; // modal cerrado -> no refrescar
      // ev.detail puede contener paciente actualizado; si coincide el publicCode, refrescar
      const updated = ev && ev.detail;
      if(updated && updated.publicCode && updated.publicCode === currentShownCode){
        showCompanionInModal(currentShownCode);
      } else {
        // fallback: buscar por código actual y refrescar si paciente existe (por si ev.detail no tiene publicCode)
        const p = patientsApi.findByPublicCode(currentShownCode);
        if(p) showCompanionInModal(currentShownCode);
      }
    } catch(e){ /* safe */ }
  });

  window.addEventListener('eseb:procedure:added', (ev)=>{
    try {
      if(!currentShownCode) return;
      if(modalView && modalView.classList.contains('hidden')) return;
      // refresh companion if showing the same patient
      const detail = ev && ev.detail;
      if(detail && detail.patientId){
        const p = patientsApi.getPatients().find(x=> x.id === detail.patientId);
        if(p && p.publicCode === currentShownCode) showCompanionInModal(currentShownCode);
      } else {
        // safe fallback
        const p = patientsApi.findByPublicCode(currentShownCode);
        if(p) showCompanionInModal(currentShownCode);
      }
    } catch(e){ /* safe */ }
  });

  window.addEventListener('eseb:procedure:edited', (ev)=>{
    try {
      if(!currentShownCode) return;
      if(modalView && modalView.classList.contains('hidden')) return;
      const detail = ev && ev.detail;
      if(detail && detail.patientId){
        const p = patientsApi.getPatients().find(x=> x.id === detail.patientId);
        if(p && p.publicCode === currentShownCode) showCompanionInModal(currentShownCode);
      } else {
        const p = patientsApi.findByPublicCode(currentShownCode);
        if(p) showCompanionInModal(currentShownCode);
      }
    } catch(e){ /* safe */ }
  });

  // also listen to storage changes (cross-tab)
  window.addEventListener('eseb:storage', ()=>{
    try {
      if(!currentShownCode) return;
      if(modalView && modalView.classList.contains('hidden')) return;
      const p = patientsApi.findByPublicCode(currentShownCode);
      if(p) showCompanionInModal(currentShownCode);
    } catch(e){ /* safe */ }
  });

  // expose API
  window.eseb = window.eseb || {};
  window.eseb.companion = {
    showCompanionInModal,
    _getCurrentShownCode: ()=> currentShownCode
  };
})();
