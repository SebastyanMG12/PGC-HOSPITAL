// companion.js
(function(){
  const patientsApi = window.eseb && window.eseb.patients;
  const modals = window.eseb && window.eseb.modals;
  const utils = window.eseb && window.eseb.utils;
  if(!patientsApi || !modals || !utils) {
    console.warn('companion: falta patients/modals/utils');
  }

  const panelCompanion = document.getElementById('panel-companion');
  const formCompanion = document.getElementById('form-companion');
  const compInput = document.getElementById('comp-code');

  // Si abrimos un modal grande, guardamos el código que mostramos
  let currentShownCode = null;

  function buildStatusHtml(p){
    if(!p) return `<div class="kv"><strong>Estado</strong><div class="muted">-</div></div>`;
    if(p.dischargedAt){
      return `<div class="kv"><strong>Estado</strong><div class="muted">Egresado · ${new Date(p.dischargedAt).toLocaleString()}</div></div>`;
    } else {
      return `<div class="kv"><strong>Estado</strong><div class="muted">Activo</div></div>`;
    }
  }

  function showCompanionInModal(code){
    if(!code) return;
    const p = patientsApi && patientsApi.findByPublicCode ? patientsApi.findByPublicCode(code) : (patientsApi && patientsApi.getPatients ? patientsApi.getPatients().find(x=> x.publicCode === code) : null);
    currentShownCode = code;

    if(!p){
      const notFoundHtml = `<div class="ig-content"><h3>Código no encontrado</h3><p class="muted">El código ingresado no corresponde a ningún paciente.</p><div style="margin-top:12px"><button class="btn ghost" id="btn-close-companion-view">Cerrar</button></div></div>`;
      if(modals && modals.openCompanionContent) modals.openCompanionContent(notFoundHtml);
      setTimeout(()=> {
        const btn = document.getElementById('btn-close-companion-view');
        if(btn) btn.addEventListener('click', ()=> {
          if(modals && modals.closeModalLarge) modals.closeModalLarge();
          currentShownCode = null;
          // hide small panel and show main container
          try {
            const panel = document.getElementById('panel-companion');
            if(panel) panel.classList.add('hidden');
            const comp = document.getElementById('comp-code');
            if(comp) comp.value = '';
            const mainContainer = document.querySelector('.container');
            if(mainContainer) mainContainer.style.display = '';
          } catch(e){}
        });
      }, 10);
      return;
    }

    let html = `<div class="ig-content-large">
      <h3>${utils ? utils.escapeHtml(p.name) : p.name}</h3>
      <div class="detail-grid">
        <div class="kv"><strong>Motivo</strong><div class="muted">${utils ? utils.escapeHtml(p.reason || '-') : (p.reason||'-')}</div></div>
        <div class="kv"><strong>Teléfono</strong><div class="muted">${utils ? utils.escapeHtml(p.phone || '-') : (p.phone||'-')}</div></div>
        ${buildStatusHtml(p)}
        <div class="kv"><strong>Llegada</strong><div class="muted">${p.arrived ? 'Confirmada '+ new Date(p.arrivedAt).toLocaleString() : 'Pendiente'}</div></div>
        <div class="kv"><strong>Hab / Camilla</strong><div class="muted">${utils ? utils.escapeHtml(p.assignedRoom || '-') : (p.assignedRoom||'-')} / ${utils ? utils.escapeHtml(p.assignedBed || '-') : (p.assignedBed||'-')}</div></div>
        <div class="kv"><strong>Atiende</strong><div class="muted">${utils ? utils.escapeHtml(p.attending || '-') : (p.attending||'-')}</div></div>
      </div>
      <div class="timeline"><h4>Procedimientos (tiempo real)</h4>`;

    if(!p.shareWithCompanion){
      html += `<div class="muted">Los procedimientos son privados para este paciente. No están disponibles para acompañantes.</div>`;
    } else {
      if(!p.procedures || p.procedures.length === 0){
        html += `<div class="muted">Sin procedimientos registrados</div>`;
      } else {
        p.procedures.forEach(pr=>{
          html += `<div class="proc"><div><strong>${utils ? utils.escapeHtml(pr.desc) : pr.desc}</strong><br><small>${utils ? utils.escapeHtml(pr.performedBy || '---') : (pr.performedBy||'---')} · ${new Date(pr.time).toLocaleString()}</small></div></div>`;
        });
      }
    }

    html += `</div><div style="margin-top:12px"><button class="btn ghost" id="btn-close-companion-view">Cerrar</button></div></div>`;

    if(modals && modals.openCompanionContent) modals.openCompanionContent(html);

    setTimeout(()=> {
      const btn = document.getElementById('btn-close-companion-view');
      if(btn) btn.addEventListener('click', ()=> {
        // Cerrar modal grande
        if(modals && modals.closeModalLarge) modals.closeModalLarge();
        // Limpiar estado y ocultar panel pequeño de companion
        currentShownCode = null;
        try { 
          const panelC = document.getElementById('panel-companion');
          if(panelC) panelC.classList.add('hidden');
          const comp = document.getElementById('comp-code');
          if(comp) { comp.value = ''; }
          // Asegurar que la vista principal esté visible (registro + accesos)
          const mainContainer = document.querySelector('.container');
          if(mainContainer) mainContainer.style.display = '';
        } catch(e){ /* safe */ }
      });
    }, 10);
  }

  // Companion form submit -> abrir modal grande con contenido
  if(formCompanion){
    formCompanion.addEventListener('submit', (ev)=>{
      ev.preventDefault();
      const code = (compInput && compInput.value) ? compInput.value.trim() : '';
      if(!code) return;
      showCompanionInModal(code);
    });
  }

  // Abrir panel-companion (pequeño) desde botón principal
  const openCompanionBtn = document.getElementById('open-companion');
  if(openCompanionBtn){
    openCompanionBtn.addEventListener('click', ()=>{
      if(panelCompanion) panelCompanion.classList.remove('hidden');
      if(compInput){ compInput.value = ''; compInput.focus(); }
      // ocultar pantalla principal ligeramente (mantener visible but not necessary)
      const mainContainer = document.querySelector('.container');
      if(mainContainer) mainContainer.style.display = '';
    });
  }

  // Botón pequeño "Cerrar" del panel companion: ocultar panel, limpiar input y mostrar principal
  const btnCloseCompanionSmall = document.getElementById('btn-close-companion');
  if(btnCloseCompanionSmall){
    btnCloseCompanionSmall.addEventListener('click', ()=>{
      if(panelCompanion) panelCompanion.classList.add('hidden');
      if(compInput) compInput.value = '';
      currentShownCode = null;
      const mainContainer = document.querySelector('.container');
      if(mainContainer) mainContainer.style.display = '';
    });
  }

  // Real-time updates: si el modal companion grande está abierto mostrando ese código, refrescarlo
  window.addEventListener('eseb:patient:updated', (ev)=>{
    try {
      if(!currentShownCode) return;
      // si modals no tiene propiedad que indique si está abierto, asumimos que si currentShownCode existe queremos refrescar
      const updated = ev && ev.detail;
      if(updated && updated.publicCode && updated.publicCode === currentShownCode){
        showCompanionInModal(currentShownCode);
      } else {
        const p = patientsApi && patientsApi.findByPublicCode ? patientsApi.findByPublicCode(currentShownCode) : (patientsApi && patientsApi.getPatients ? patientsApi.getPatients().find(x=> x.publicCode === currentShownCode) : null);
        if(p) showCompanionInModal(currentShownCode);
      }
    } catch(e){ /* safe */ }
  });

  window.addEventListener('eseb:procedure:added', (ev)=>{
    try {
      if(!currentShownCode) return;
      const detail = ev && ev.detail;
      if(detail && detail.patientId){
        const p = patientsApi && patientsApi.getPatients ? patientsApi.getPatients().find(x=> x.id === detail.patientId) : null;
        if(p && p.publicCode === currentShownCode) showCompanionInModal(currentShownCode);
      } else {
        const p = patientsApi && patientsApi.findByPublicCode ? patientsApi.findByPublicCode(currentShownCode) : (patientsApi && patientsApi.getPatients ? patientsApi.getPatients().find(x=> x.publicCode === currentShownCode) : null);
        if(p) showCompanionInModal(currentShownCode);
      }
    } catch(e){ /* safe */ }
  });

  window.addEventListener('eseb:procedure:edited', (ev)=>{
    try {
      if(!currentShownCode) return;
      const detail = ev && ev.detail;
      if(detail && detail.patientId){
        const p = patientsApi && patientsApi.getPatients ? patientsApi.getPatients().find(x=> x.id === detail.patientId) : null;
        if(p && p.publicCode === currentShownCode) showCompanionInModal(currentShownCode);
      } else {
        const p = patientsApi && patientsApi.findByPublicCode ? patientsApi.findByPublicCode(currentShownCode) : (patientsApi && patientsApi.getPatients ? patientsApi.getPatients().find(x=> x.publicCode === currentShownCode) : null);
        if(p) showCompanionInModal(currentShownCode);
      }
    } catch(e){ /* safe */ }
  });

  // cross-tab storage change
  window.addEventListener('eseb:storage', ()=>{
    try {
      if(!currentShownCode) return;
      const p = patientsApi && patientsApi.findByPublicCode ? patientsApi.findByPublicCode(currentShownCode) : (patientsApi && patientsApi.getPatients ? patientsApi.getPatients().find(x=> x.publicCode === currentShownCode) : null);
      if(p) showCompanionInModal(currentShownCode);
    } catch(e){ /* safe */ }
  });
  
  window.eseb = window.eseb || {};
  window.eseb.companion = {
    showCompanionInModal,
    _getCurrentShownCode: ()=> currentShownCode
  };
})();
