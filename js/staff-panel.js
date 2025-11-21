// staff-panel.js
(function(){
  const patientsApi = window.eseb && window.eseb.patients;
  const roomsApi = window.eseb && window.eseb.rooms;
  const doctorsApi = window.eseb && window.eseb.doctors;
  const proceduresApi = window.eseb && window.eseb.procedures;
  const auth = window.eseb && window.eseb.auth;
  const modals = window.eseb && window.eseb.modals;
  const utils = window.eseb && window.eseb.utils;
  const audit = window.eseb && window.eseb.audit;
  if(!patientsApi || !roomsApi || !doctorsApi || !proceduresApi || !auth || !modals || !utils || !audit) {
    console.warn('staff-panel: faltan dependencias (asegúrate de cargar storage/utils/audit/modals antes)');
  }

  // UI elements
  const panelStaff = document.getElementById('panel-staff');
  const patientListEl = document.getElementById('patient-list');
  const patientDetailEl = document.getElementById('patient-detail');
  const searchInput = document.getElementById('search-patient');
  const btnSearch = document.getElementById('btn-search');

  const btnViewActive = document.getElementById('btn-view-active');
  const btnViewEgresados = document.getElementById('btn-view-egresados');
  const btnLogout = document.getElementById('btn-logout');

  let currentListFilter = 'all'; // 'all' | 'active' | 'discharged'

  /* ---------------------------
     Helper: format status text
     --------------------------- */
  function patientStatus(p){
    if(!p) return '-';
    if(p.dischargedAt) return `Egresado · ${new Date(p.dischargedAt).toLocaleString()}`;
    return 'Activo';
  }

  /* ---------------------------
     Render list (left column)
     --------------------------- */
  function renderPatientList(textFilter=''){
    const all = (patientsApi && patientsApi.getPatients && patientsApi.getPatients()) || [];
    const f = (textFilter || '').toLowerCase().trim();

    let filtered = all.filter(p=>{
      if(currentListFilter === 'active') return !p.dischargedAt;
      if(currentListFilter === 'discharged') return !!p.dischargedAt;
      return true;
    });

    if(f){
      filtered = filtered.filter(p=>{
        return (p.name && p.name.toLowerCase().includes(f)) ||
               (p.internalId && p.internalId.toLowerCase().includes(f)) ||
               (p.publicCode && p.publicCode.toLowerCase().includes(f)) ||
               (p.reason && p.reason.toLowerCase().includes(f));
      });
    }

    if(!patientListEl) return;
    patientListEl.innerHTML = '';
    if(filtered.length === 0){
      patientListEl.innerHTML = '<div class="muted">No hay pacientes registrados</div>';
      return;
    }

    filtered.forEach(p=>{
      const div = document.createElement('div');
      div.className = 'patient-item';
      div.innerHTML = `<div>
                        <strong>${utils ? utils.escapeHtml(p.name) : p.name}</strong><br>
                        <small>${utils ? utils.escapeHtml(p.reason || '') : (p.reason||'')} · ${utils ? utils.escapeHtml(p.phone || '') : (p.phone||'')}</small>
                       </div>
                       <div style="text-align:right">
                         <small>Public: ${utils ? utils.escapeHtml(p.publicCode) : p.publicCode}</small><br>
                         <small>Creado: ${new Date(p.createdAt).toLocaleString()}</small>
                       </div>`;
      div.addEventListener('click', ()=> showPatientDetail(p.id));
      patientListEl.appendChild(div);
    });
  }

  /* ---------------------------
     Show patient detail (medico) with companion fields optional
     --------------------------- */
  function showPatientDetail(patientId){
    const session = auth && auth.currentSession ? auth.currentSession() : null;
    const role = session ? session.role : null;
    const p = (patientsApi && patientsApi.getPatients ? patientsApi.getPatients().find(x=> x.id === patientId) : null);
    if(!p){
      if(patientDetailEl) patientDetailEl.innerHTML = '<div class="muted">Paciente no encontrado</div>';
      return;
    }

    // If role is admin, render admin-specific view (table handled elsewhere)
    if(role === 'admin'){
      // open detailed modal for admin instead of full editable right panel
      openAdminPatientDetailModal(patientId);
      return;
    }

    // role medico — render editable detail with companion inputs
    // Determine disabled states for buttons
    const arrivedDisabled = p.arrived ? 'disabled' : '';
    const admitDisabled = p.admittedAt ? 'disabled' : '';
    const dischargeDisabled = p.dischargedAt ? 'disabled' : '';

    let html = `<div>
      <div class="detail-card">
        <h3>${utils ? utils.escapeHtml(p.name) : p.name}</h3>
        <div class="detail-grid">
          <div class="kv"><strong>Creado</strong><div class="muted">${new Date(p.createdAt).toLocaleString()}</div></div>
          <div class="kv"><strong>Código público</strong><div class="muted">${utils ? utils.escapeHtml(p.publicCode) : p.publicCode}</div></div>
          <div class="kv"><strong>Teléfono</strong><div class="muted">${utils ? utils.escapeHtml(p.phone || '-') : (p.phone||'-')}</div></div>
          <div class="kv"><strong>Motivo</strong><div class="muted">${utils ? utils.escapeHtml(p.reason || '-') : (p.reason||'-')}</div></div>
          <div class="kv"><strong>Notas</strong><div class="muted">${utils ? utils.escapeHtml(p.notes || '-') : (p.notes||'-')}</div></div>
        </div>`;

    html += `<div style="margin-top:12px">
        <div class="detail-grid">
          <div class="kv"><strong>Internal ID</strong><div class="muted">${utils ? utils.escapeHtml(p.internalId) : p.internalId}</div></div>
          <div class="kv"><strong>Documento</strong><div class="muted">${utils ? utils.escapeHtml(p.doc || '-') : (p.doc||'-')}</div></div>
          <div class="kv"><strong>Estado</strong><div class="muted">${patientStatus(p)}</div></div>
          <div class="kv"><strong>Hab / Camilla</strong><div class="muted">${utils ? utils.escapeHtml(p.assignedRoom || '-') : (p.assignedRoom||'-')} / ${utils ? utils.escapeHtml(p.assignedBed || '-') : (p.assignedBed||'-')}</div></div>
          <div class="kv"><strong>Atiende</strong><div class="muted">${utils ? utils.escapeHtml(p.attending || '-') : (p.attending||'-')}</div></div>
          <div class="kv"><strong>Llegada</strong><div class="muted">${p.arrived ? new Date(p.arrivedAt).toLocaleString() : 'Pendiente'}</div></div>
          <div class="kv"><strong>Ingreso</strong><div class="muted">${p.admittedAt ? new Date(p.admittedAt).toLocaleString() : '-'}</div></div>
          <div class="kv"><strong>Egreso</strong><div class="muted">${p.dischargedAt ? new Date(p.dischargedAt).toLocaleString() : '-'}</div></div>
        </div>
      </div>`;

    // Companion (optional) - editable inputs for staff
    html += `<div style="margin-top:12px" class="detail-card">
      <h4>Información del acompañante (opcional)</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div><label>Nombre</label><input id="inp-comp-name" class="ig-input" placeholder="Nombre acompañante" value="${utils ? utils.escapeHtml(p.companionName || '') : (p.companionName||'')}"></div>
        <div><label>Teléfono</label><input id="inp-comp-phone" class="ig-input" placeholder="Teléfono acompañante" value="${utils ? utils.escapeHtml(p.companionPhone || '') : (p.companionPhone||'')}"></div>
        <div style="grid-column:1/3"><label>Parentesco</label><input id="inp-comp-rel" class="ig-input" placeholder="Parentesco" value="${utils ? utils.escapeHtml(p.companionRelation || '') : (p.companionRelation||'')}"></div>
      </div>
      <div style="margin-top:8px"><button class="btn primary" id="btn-save-companion">Guardar acompañante</button></div>
    </div>`;

    // Actions (existing)
    html += `<div style="margin-top:10px" class="detail-card">
        <strong>Acciones</strong>
        <div style="margin-top:8px" class="row">
          <button class="btn primary" id="btn-open-confirm-arrival" ${arrivedDisabled}>${p.arrived ? 'Llegada confirmada' : 'Confirmar llegada'}</button>
          <button class="btn" id="btn-open-assign-room">Asignar Hab/Cam</button>
          <button class="btn" id="btn-open-assign-doctor">Asignar personal</button>
          <button class="btn ghost" id="btn-open-set-admit" ${admitDisabled}>${p.admittedAt ? 'Ingreso marcado' : 'Marcar ingreso'}</button>
          <button class="btn ghost" id="btn-open-set-discharge" ${dischargeDisabled}>${p.dischargedAt ? 'Egreso marcado' : 'Marcar egreso'}</button>
        </div>
        <div style="margin-top:10px">
          <label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="chk-share-proc" ${p.shareWithCompanion ? 'checked' : ''}/> Compartir historial de procedimientos con acompañante</label>
        </div>
    </div>`;

    // IMPORTANT: Agregar procedimiento siempre visible para personal autorizado (medico/admin)
    html += `<hr />
      <div style="margin-top:10px" class="detail-card">
        <strong>Agregar procedimiento / nota de atención</strong>
        <div style="margin-top:8px">
          <!-- Inputs siempre visibles para personal autorizado -->
          <input id="inp-proc-desc" placeholder="Descripción del procedimiento / orden" />
          <input id="inp-proc-by" placeholder="Realizado por (nombre)" />
          <div style="margin-top:8px" class="row">
            <button class="btn primary" id="btn-add-proc">Agregar</button>
            <small class="small-muted" style="align-self:center">* No podrás agregar si faltan campos obligatorios del paciente</small>
          </div>
        </div>
      </div>`;

    // Procedures list and edit buttons
    html += `<div class="timeline" style="margin-top:10px"><h4>Historial de procedimientos</h4>`;
    if(!p.procedures || p.procedures.length === 0) html += `<div class="muted">Sin procedimientos registrados</div>`;
    (p.procedures || []).forEach(pr=>{
      html += `<div class="proc">
                 <div>
                   <strong>${utils ? utils.escapeHtml(pr.desc) : pr.desc}</strong><br>
                   <small>${utils ? utils.escapeHtml(pr.performedBy || '---') : (pr.performedBy||'---')} · ${new Date(pr.time).toLocaleString()}</small>
                 </div>
                 <div class="proc-actions">`;
      html += `<button class="btn" data-proc-edit="${utils ? utils.escapeHtml(pr.id) : pr.id}" data-proc-patient="${utils ? utils.escapeHtml(p.id) : p.id}">Editar</button>`;
      html += `</div></div>`;
    });
    html += `</div>`;

    if(patientDetailEl) patientDetailEl.innerHTML = `<div data-patient-id="${p.id}">` + html + `</div>`;

    // Companion save handler (fix #1 and #2)
    const btnSaveComp = document.getElementById('btn-save-companion');
    if(btnSaveComp){
      btnSaveComp.addEventListener('click', ()=>{
        const compName = document.getElementById('inp-comp-name').value.trim() || null;
        const compPhone = document.getElementById('inp-comp-phone').value.trim() || null;
        const compRel = document.getElementById('inp-comp-rel').value.trim() || null;

        // VALIDATION: if all companion fields empty -> show message (change #1)
        const allEmpty = (!compName || compName === '') && (!compPhone || compPhone === '') && (!compRel || compRel === '');
        if(allEmpty){
          // show friendly message and do not save
          if(modals && modals.openModalLarge){
            const htmlMsg = `<div class="ig-content-large"><h3>Faltan datos</h3><p class="muted">Debes agregar al menos un campo del acompañante (nombre, teléfono o parentesco) antes de guardar.</p></div>`;
            modals.openModalLarge(htmlMsg);
            setTimeout(()=> { if(modals && modals.closeModalLarge) modals.closeModalLarge(); }, 1600);
          } else {
            alert('Debes agregar al menos el nombre, teléfono o parentesco del acompañante antes de guardar.');
          }
          return;
        }

        // Save and ensure companion info is propagated in real-time (change #2)
        let updatedPatient = null;
        if(patientsApi && patientsApi.updatePatient){
          try {
            updatedPatient = patientsApi.updatePatient(p.id, {
              companionName: compName,
              companionPhone: compPhone,
              companionRelation: compRel
            }, { action:'update_companion', details: { companionName: compName, companionPhone: compPhone, companionRelation: compRel }});
          } catch(e){
            console.warn('Error actualizando acompañante', e);
          }
        }

        // Show confirmation window (simple modal)
        if(modals && modals.openModalLarge){
          const htmlMsg = `<div class="ig-content-large"><h3>Información guardada</h3><p class="muted">La información del acompañante se ha guardado correctamente.</p></div>`;
          modals.openModalLarge(htmlMsg);
          setTimeout(()=> { if(modals && modals.closeModalLarge) modals.closeModalLarge(); }, 1400);
        } else {
          alert('Información guardada correctamente');
        }

        // Force-emission of patient updated so companion module (y otras vistas) se refresquen inmediatamente
        // patientsApi.updatePatient ya despacha 'eseb:patient:updated', pero emitimos de nuevo con el objeto retornado por seguridad.
        if(updatedPatient){
          try{
            window.dispatchEvent(new CustomEvent('eseb:patient:updated', { detail: updatedPatient }));
          }catch(e){}
        }

        // re-render detail and list - admin and companion listeners will react to eseb:patient:updated
        showPatientDetail(p.id); // re-render detail in this view
        renderPatientList(searchInput ? searchInput.value.trim() : '');
      });
    }

    // Attach action buttons handlers (reusing modal helpers)
    const btnArrival = document.getElementById('btn-open-confirm-arrival');
    if(btnArrival) btnArrival.addEventListener('click', ()=> openArrivalModal(p.id));

    const btnAssignRoom = document.getElementById('btn-open-assign-room');
    if(btnAssignRoom) btnAssignRoom.addEventListener('click', ()=> openAssignRoomModal(p.id));

    const btnAssignDoctor = document.getElementById('btn-open-assign-doctor');
    if(btnAssignDoctor) btnAssignDoctor.addEventListener('click', ()=> openAssignDoctorModal(p.id));

    const btnAdmit = document.getElementById('btn-open-set-admit');
    if(btnAdmit) btnAdmit.addEventListener('click', ()=> openAdmitModal(p.id));

    const btnDischarge = document.getElementById('btn-open-set-discharge');
    if(btnDischarge) btnDischarge.addEventListener('click', ()=> openDischargeModal(p.id));

    const chk = document.getElementById('chk-share-proc');
    if(chk){
      chk.addEventListener('change', ()=> {
        if(patientsApi && patientsApi.updatePatient){
          patientsApi.updatePatient(p.id, { shareWithCompanion: !!chk.checked }, { action:'toggle_share_procedures', details: { shareWithCompanion: !!chk.checked } });
        }
        // Do not hide the add procedure inputs — visibility unchanged
        showPatientDetail(p.id);
      });
    }

    // add proc handler (with required fields validation)
    const btnAddProc = document.getElementById('btn-add-proc');
    if(btnAddProc){
      btnAddProc.addEventListener('click', ()=>{
        const descEl = document.getElementById('inp-proc-desc');
        const byEl = document.getElementById('inp-proc-by');
        const desc = descEl ? descEl.value.trim() : '';
        const by = byEl ? byEl.value.trim() : (auth && auth.currentSession ? (auth.currentSession().username || 'staff') : 'staff');

        if(!desc) return alert('Describe el procedimiento');

        // validate required patient fields: arrived, room, bed, attending
        const fresh = (patientsApi && patientsApi.getPatients ? patientsApi.getPatients().find(x=> x.id === p.id) : p);
        const missing = [];
        if(!fresh.arrived) missing.push('Confirmar llegada');
        if(!fresh.assignedRoom) missing.push('Asignar habitación/sala');
        if(!fresh.assignedBed) missing.push('Asignar camilla');
        if(!fresh.attending) missing.push('Asignar personal que atiende');
        if(missing.length > 0){
          return alert('No es posible agregar procedimientos. Faltan campos obligatorios: ' + missing.join(', '));
        }

        // add procedure
        if(proceduresApi && proceduresApi.addProcedure){
          proceduresApi.addProcedure(p.id, desc, by);
        } else if(patientsApi && patientsApi.addProcedure){
          // backward compat: if patientsApi manages procedures
          patientsApi.addProcedure(p.id, desc, by);
        }
        if(descEl) descEl.value = '';
        if(byEl) byEl.value = '';

        // refresh UI
        renderPatientList(searchInput ? searchInput.value.trim() : '');
        showPatientDetail(p.id);
      });
    }

    // edit proc buttons
    const procEditBtns = patientDetailEl.querySelectorAll('[data-proc-edit]');
    procEditBtns.forEach(btn => {
      btn.addEventListener('click', ()=> {
        const procId = btn.getAttribute('data-proc-edit');
        const pid = btn.getAttribute('data-proc-patient');
        openEditProcedureModal(pid, procId);
      });
    });
  }

  /* ---------------------------
     MEDICO modal helpers
     --------------------------- */
  function openArrivalModal(patientId){
    const p = (patientsApi && patientsApi.getPatients ? patientsApi.getPatients().find(x=> x.id === patientId) : null);
    const html = `<div class="ig-content-large">
      <h3>Confirmar llegada - ${utils ? utils.escapeHtml(p ? p.name : '') : ''}</h3>
      <p class="muted">Al confirmar llegada se registra la hora de llegada del paciente.</p>
      <div style="margin-top:12px">
        <button class="btn primary" id="btn-confirm-arrival-ok">Confirmar llegada</button>
        <button class="btn ghost" id="btn-cancel-arrival">Cerrar</button>
      </div>
    </div>`;
    if(modals && modals.openModalLarge) modals.openModalLarge(html);
    setTimeout(()=>{
      const ok = document.getElementById('btn-confirm-arrival-ok');
      const cancel = document.getElementById('btn-cancel-arrival');
      if(ok) ok.addEventListener('click', ()=> {
        if(patientsApi && patientsApi.updatePatient) patientsApi.updatePatient(patientId, { arrived: true, arrivedAt: utils.now() }, { action:'confirm_arrival' });
        renderPatientList(searchInput ? searchInput.value.trim() : '');
        showPatientDetail(patientId);
        if(modals && modals.closeModalLarge) modals.closeModalLarge();
      });
      if(cancel) cancel.addEventListener('click', ()=> { if(modals && modals.closeModalLarge) modals.closeModalLarge(); });
    }, 10);
  }

  function openAssignRoomModal(patientId){
    const rooms = roomsApi && roomsApi.getRooms ? roomsApi.getRooms() : [];
    let html = `<div class="ig-content-large"><h3>Asignar habitación / camilla</h3>
      <p class="muted">Selecciona una cama disponible.</p>
      <div class="room-list">`;
    rooms.forEach(room => {
      html += `<div class="room-item"><div><strong>Hab ${utils ? utils.escapeHtml(room.roomLabel) : room.roomLabel}</strong> <small class="muted">Camas:</small></div><div>`;
      room.beds.forEach(b => {
        if(b.occupiedBy){
          html += `<span style="margin-left:8px"><span class="badge">Ocupada</span> <small class="muted">${utils ? utils.escapeHtml(b.label) : b.label}</small></span>`;
        } else {
          html += `<button class="btn" data-assign-bed="${utils ? utils.escapeHtml(b.id) : b.id}" data-room="${utils ? utils.escapeHtml(room.roomLabel) : room.roomLabel}" style="margin-left:8px">Asignar ${utils ? utils.escapeHtml(b.label) : b.label}</button>`;
        }
      });
      html += `</div></div>`;
    });
    html += `</div><div style="margin-top:12px"><button class="btn ghost" id="btn-cancel-assign-room">Cerrar</button></div></div>`;
    if(modals && modals.openModalLarge) modals.openModalLarge(html);
    setTimeout(()=>{
      const assignBtns = document.querySelectorAll('[data-assign-bed]');
      assignBtns.forEach(btn => {
        btn.addEventListener('click', ()=> {
          const bedId = btn.getAttribute('data-assign-bed');
          const roomLabel = btn.getAttribute('data-room');
          try{
            if(roomsApi && roomsApi.assignBed) roomsApi.assignBed(patientId, bedId);
            if(patientsApi && patientsApi.updatePatient) patientsApi.updatePatient(patientId, { assignedRoom: roomLabel, assignedBed: bedId }, { action:'assign_bed', details: { room: roomLabel, bed: bedId } });
            renderPatientList(searchInput ? searchInput.value.trim() : '');
            showPatientDetail(patientId);
            if(modals && modals.closeModalLarge) modals.closeModalLarge();
          }catch(err){
            alert(err.message || 'Error asignando cama');
          }
        });
      });
      const cancel = document.getElementById('btn-cancel-assign-room');
      if(cancel) cancel.addEventListener('click', ()=> { if(modals && modals.closeModalLarge) modals.closeModalLarge(); });
    }, 10);
  }

  /* ---------------------------
     Asignar doctor (mejoras para refrescar en tiempo real cuando cambian doctores)
     --------------------------- */
  function openAssignDoctorModal(patientId){
    // We'll build the modal content and attach a listener to eseb:doctors:changed
    const buildHtml = ()=>{
      const doctors = doctorsApi && doctorsApi.getDoctors ? doctorsApi.getDoctors() : [];
      let html = `<div class="ig-content-large"><h3>Asignar personal (doctor/enfermero)</h3>
        <p class="muted">Selecciona el personal que atenderá (puede atender a varios pacientes).</p>
        <div class="doctor-list">`;
      doctors.forEach(doc => {
        html += `<div class="doctor-item"><div><strong>${utils ? utils.escapeHtml(doc.name) : doc.name}</strong><div class="muted">Atendiendo: ${doc.patients ? doc.patients.length : 0} pacientes</div></div>
                  <div><button class="btn" data-assign-doctor="${utils ? utils.escapeHtml(doc.id) : doc.id}">Asignar</button></div></div>`;
      });
      html += `</div><div style="margin-top:12px"><button class="btn ghost" id="btn-cancel-assign-doc">Cerrar</button></div></div>`;
      return html;
    };

    // Render initial modal
    if(modals && modals.openModalLarge) modals.openModalLarge(buildHtml());

    // Handler that attaches to dynamic buttons; we'll call it on initial render and whenever doctors change
    const attachHandlers = ()=>{
      // assign buttons
      const assignBtns = document.querySelectorAll('[data-assign-doctor]');
      assignBtns.forEach(btn => {
        // avoid double-binding by cloning node: remove and reattach fresh listener by replacing with same element (simple guard)
        // (simpler approach: remove all listeners by replacing node)
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', ()=> {
          const docId = newBtn.getAttribute('data-assign-doctor');
          try{
            if(doctorsApi && doctorsApi.assignPatientToDoctor) doctorsApi.assignPatientToDoctor(docId, patientId);
            const doc = doctorsApi.getDoctors().find(d => d.id === docId);
            if(patientsApi && patientsApi.updatePatient) patientsApi.updatePatient(patientId, { attending: doc.name }, { action:'assign_staff', details: { staffId: doc.id, staffName: doc.name }});
            renderPatientList(searchInput ? searchInput.value.trim() : '');
            showPatientDetail(patientId);
            // cleanup listener and close modal
            window.removeEventListener('eseb:doctors:changed', doctorsChangedHandler);
            if(modals && modals.closeModalLarge) modals.closeModalLarge();
          }catch(err){
            alert(err.message || 'Error asignando personal');
          }
        });
      });

      // cancel button
      const cancel = document.getElementById('btn-cancel-assign-doc');
      if(cancel){
        const newCancel = cancel.cloneNode(true);
        cancel.parentNode.replaceChild(newCancel, cancel);
        newCancel.addEventListener('click', ()=> {
          window.removeEventListener('eseb:doctors:changed', doctorsChangedHandler);
          if(modals && modals.closeModalLarge) modals.closeModalLarge();
        });
      }
    };

    // Handler to refresh modal content when doctors change
    const doctorsChangedHandler = ()=>{
      // if modal is open, re-render content and reattach handlers
      try{
        const modalContent = document.getElementById('modal-view-content');
        const modalView = document.getElementById('modal-view');
        if(modalView && !modalView.classList.contains('hidden') && modalContent){
          modalContent.innerHTML = buildHtml();
          // small timeout to wait DOM to be replaced
          setTimeout(()=> attachHandlers(), 10);
        } else {
          // if modal closed, remove listener defensively
          window.removeEventListener('eseb:doctors:changed', doctorsChangedHandler);
        }
      }catch(e){}
    };

    // initial attach
    setTimeout(()=> {
      attachHandlers();
      // listen for doctor changes to refresh counts in real-time
      window.addEventListener('eseb:doctors:changed', doctorsChangedHandler);
    }, 10);
  }

  function openAdmitModal(patientId){
    const p = (patientsApi && patientsApi.getPatients ? patientsApi.getPatients().find(x=> x.id === patientId) : null);
    const html = `<div class="ig-content-large">
      <h3>Marcar ingreso - ${utils ? utils.escapeHtml(p ? p.name : '') : ''}</h3>
      <p class="muted">Registrar hora de ingreso.</p>
      <div style="margin-top:12px">
        <button class="btn primary" id="btn-confirm-admit">Marcar ingreso</button>
        <button class="btn ghost" id="btn-cancel-admit">Cerrar</button>
      </div>
    </div>`;
    if(modals && modals.openModalLarge) modals.openModalLarge(html);
    setTimeout(()=>{
      const confirm = document.getElementById('btn-confirm-admit');
      const cancel = document.getElementById('btn-cancel-admit');
      if(confirm) confirm.addEventListener('click', ()=>{
        if(patientsApi && patientsApi.updatePatient) patientsApi.updatePatient(patientId, { admittedAt: utils.now() }, { action:'mark_admit' });
        renderPatientList(searchInput ? searchInput.value.trim() : '');
        showPatientDetail(patientId);
        if(modals && modals.closeModalLarge) modals.closeModalLarge();
      });
      if(cancel) cancel.addEventListener('click', ()=> { if(modals && modals.closeModalLarge) modals.closeModalLarge(); });
    }, 10);
  }

  function openDischargeModal(patientId){
    const p = (patientsApi && patientsApi.getPatients ? patientsApi.getPatients().find(x=> x.id === patientId) : null);
    const html = `<div class="ig-content-large">
      <h3>Marcar egreso - ${utils ? utils.escapeHtml(p ? p.name : '') : ''}</h3>
      <p class="muted">Registrar egreso y liberar recursos (camilla, actualizar doctor).</p>
      <div style="margin-top:12px">
        <button class="btn primary" id="btn-confirm-discharge">Confirmar egreso</button>
        <button class="btn ghost" id="btn-cancel-discharge">Cerrar</button>
      </div>
    </div>`;
    if(modals && modals.openModalLarge) modals.openModalLarge(html);
    setTimeout(()=>{
      const confirm = document.getElementById('btn-confirm-discharge');
      const cancel = document.getElementById('btn-cancel-discharge');
      if(confirm) confirm.addEventListener('click', ()=>{
        // free bed
        const patient = (patientsApi && patientsApi.getPatients ? patientsApi.getPatients().find(x=> x.id === patientId) : null);
        if(patient && patient.assignedBed){
          if(roomsApi && roomsApi.releaseBed) roomsApi.releaseBed(patient.assignedBed);
        }
        // remove from doctor
        if(patient && patient.attending){
          const docs = doctorsApi && doctorsApi.getDoctors ? doctorsApi.getDoctors() : [];
          const doc = docs.find(d=> d.name === patient.attending);
          if(doc && doctorsApi && doctorsApi.removePatientFromDoctor) doctorsApi.removePatientFromDoctor(doc.id, patientId);
        }
        if(patientsApi && patientsApi.updatePatient) patientsApi.updatePatient(patientId, { dischargedAt: utils.now() }, { action:'mark_discharge' });

        // After discharge we must ensure UI reflects doctor counts (doctors.saveDoctors triggers 'eseb:doctors:changed')
        // render lists & detail
        renderPatientList(searchInput ? searchInput.value.trim() : '');
        showPatientDetail(patientId);
        if(modals && modals.closeModalLarge) modals.closeModalLarge();
      });
      if(cancel) cancel.addEventListener('click', ()=> { if(modals && modals.closeModalLarge) modals.closeModalLarge(); });
    }, 10);
  }

  function openEditProcedureModal(patientId, procedureId){
    const patients = patientsApi && patientsApi.getPatients ? patientsApi.getPatients() : [];
    const p = patients.find(x=> x.id === patientId);
    if(!p) return alert('Paciente no encontrado');
    const pr = (p.procedures || []).find(x => x.id === procedureId);
    if(!pr) return alert('Procedimiento no encontrado');

    const html = `<div class="ig-content-large">
      <h3>Editar procedimiento</h3>
      <p class="muted">Modifica la descripción o el responsable del procedimiento.</p>
      <div style="margin-top:12px">
        <label>Descripción</label>
        <input id="edit-proc-desc" value="${utils ? utils.escapeHtml(pr.desc) : pr.desc}" />
        <label>Realizado por</label>
        <input id="edit-proc-by" value="${utils ? utils.escapeHtml(pr.performedBy || '') : (pr.performedBy||'')}" />
        <div style="margin-top:12px">
          <button class="btn primary" id="btn-save-proc-edit">Guardar</button>
          <button class="btn ghost" id="btn-cancel-proc-edit">Cancelar</button>
        </div>
      </div>
    </div>`;
    if(modals && modals.openModalLarge) modals.openModalLarge(html);
    setTimeout(()=>{
      const saveBtn = document.getElementById('btn-save-proc-edit');
      const cancelBtn = document.getElementById('btn-cancel-proc-edit');
      if(saveBtn) saveBtn.addEventListener('click', ()=>{
        const newDesc = document.getElementById('edit-proc-desc').value.trim();
        const newBy = document.getElementById('edit-proc-by').value.trim() || (auth && auth.currentSession ? (auth.currentSession().username || 'staff') : 'staff');
        if(!newDesc) return alert('La descripción no puede estar vacía');
        if(proceduresApi && proceduresApi.editProcedure) proceduresApi.editProcedure(patientId, procedureId, newDesc, newBy);
        if(modals && modals.closeModalLarge) modals.closeModalLarge();
      });
      if(cancelBtn) cancelBtn.addEventListener('click', ()=> { if(modals && modals.closeModalLarge) modals.closeModalLarge(); });
    }, 10);
  }

  /* ---------------------------
     ADMIN: render table with full data
     --------------------------- */
  function renderAdminTable(){
    // Right panel becomes admin table
    if(!patientDetailEl) return;
    patientDetailEl.innerHTML = ''; // clear any detail
    const patients = (patientsApi && patientsApi.getPatients ? patientsApi.getPatients() : []);

    const table = document.createElement('table');
    table.className = 'admin-table';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
      <th>Nombre</th><th>Internal ID</th><th>Código público</th><th>Estado</th>
      <th>Llegada</th><th>Ingreso</th><th>Egreso</th><th>Atiende</th>
      <th>Hab / Camilla</th><th>Procedimientos</th><th>Acompañante</th><th>Acciones</th>
    </tr>`;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');

    patients.forEach(p=>{
      const tr = document.createElement('tr');
      const procCount = (p.procedures || []).length;
      const companion = p.companionName ? `${utils ? utils.escapeHtml(p.companionName) : p.companionName} (${utils ? utils.escapeHtml(p.companionRelation||'') : (p.companionRelation||'')}) ${utils ? utils.escapeHtml(p.companionPhone||'') : (p.companionPhone||'')}` : '-';
      tr.innerHTML = `<td>${utils ? utils.escapeHtml(p.name) : p.name}</td>
        <td>${utils ? utils.escapeHtml(p.internalId) : p.internalId}</td>
        <td>${utils ? utils.escapeHtml(p.publicCode) : p.publicCode}</td>
        <td>${p.dischargedAt ? 'Egresado' : 'Activo'}</td>
        <td>${p.arrived ? new Date(p.arrivedAt).toLocaleString() : '-'}</td>
        <td>${p.admittedAt ? new Date(p.admittedAt).toLocaleString() : '-'}</td>
        <td>${p.dischargedAt ? new Date(p.dischargedAt).toLocaleString() : '-'}</td>
        <td>${utils ? utils.escapeHtml(p.attending || '-') : (p.attending||'-')}</td>
        <td>${utils ? utils.escapeHtml(p.assignedRoom || '-') : (p.assignedRoom||'-')} / ${utils ? utils.escapeHtml(p.assignedBed || '-') : (p.assignedBed||'-')}</td>
        <td>${procCount}</td>
        <td>${companion}</td>
        <td><button class="btn" data-admin-view="${utils ? utils.escapeHtml(p.id) : p.id}">Ver</button> <button class="btn ghost" data-admin-audit="${utils ? utils.escapeHtml(p.id) : p.id}">Historial</button></td>`;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    const wrapper = document.createElement('div');
    wrapper.style.overflow = 'auto';
    wrapper.style.maxHeight = '78vh';
    wrapper.appendChild(table);
    patientDetailEl.appendChild(wrapper);

    // bind actions
    const viewBtns = patientDetailEl.querySelectorAll('[data-admin-view]');
    viewBtns.forEach(btn => {
      btn.addEventListener('click', ()=> {
        const pid = btn.getAttribute('data-admin-view');
        openAdminPatientDetailModal(pid);
      });
    });
    const auditBtns = patientDetailEl.querySelectorAll('[data-admin-audit]');
    auditBtns.forEach(btn => {
      btn.addEventListener('click', ()=> {
        const pid = btn.getAttribute('data-admin-audit');
        openAdminAuditModal(pid);
      });
    });
  }

  /* ---------------------------
     ADMIN modals
     --------------------------- */
  function openAdminPatientDetailModal(patientId){
    const p = (patientsApi && patientsApi.getPatients ? patientsApi.getPatients().find(x=> x.id === patientId) : null);
    if(!p) return alert('Paciente no encontrado');

    let html = `<div style="max-width:900px">
      <h3>Detalle paciente - ${utils ? utils.escapeHtml(p.name) : p.name}</h3>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
        <div><strong>Internal ID</strong><div class="muted">${utils ? utils.escapeHtml(p.internalId) : p.internalId}</div></div>
        <div><strong>Código público</strong><div class="muted">${utils ? utils.escapeHtml(p.publicCode) : p.publicCode}</div></div>
        <div><strong>Documento</strong><div class="muted">${utils ? utils.escapeHtml(p.doc || '-') : (p.doc||'-')}</div></div>
        <div><strong>Teléfono</strong><div class="muted">${utils ? utils.escapeHtml(p.phone || '-') : (p.phone||'-')}</div></div>
        <div><strong>Estado</strong><div class="muted">${patientStatus(p)}</div></div>
        <div><strong>Hab / Camilla</strong><div class="muted">${utils ? utils.escapeHtml(p.assignedRoom||'-') : (p.assignedRoom||'-')} / ${utils ? utils.escapeHtml(p.assignedBed||'-') : (p.assignedBed||'-')}</div></div>
        <div><strong>Atiende</strong><div class="muted">${utils ? utils.escapeHtml(p.attending || '-') : (p.attending||'-')}</div></div>
        <div><strong>Llegada</strong><div class="muted">${p.arrived ? new Date(p.arrivedAt).toLocaleString() : '-'}</div></div>
        <div><strong>Ingreso</strong><div class="muted">${p.admittedAt ? new Date(p.admittedAt).toLocaleString() : '-'}</div></div>
        <div style="grid-column:1/3"><strong>Notas</strong><div class="muted">${utils ? utils.escapeHtml(p.notes || '-') : (p.notes||'-')}</div></div>
        <div style="grid-column:1/3"><strong>Acompañante</strong><div class="muted">${p.companionName ? `${utils ? utils.escapeHtml(p.companionName) : p.companionName} · ${utils ? utils.escapeHtml(p.companionRelation || '') : (p.companionRelation||'')} · ${utils ? utils.escapeHtml(p.companionPhone || '') : (p.companionPhone||'')}` : '-'}</div></div>
      </div>
      <hr />
      <h4>Procedimientos</h4>`;

    if(!p.procedures || p.procedures.length === 0){
      html += `<div class="muted">Sin procedimientos registrados</div>`;
    } else {
      html += `<div style="display:flex;flex-direction:column;gap:8px">`;
      p.procedures.forEach(pr=>{
        html += `<div style="padding:8px;border-radius:8px;border:1px solid rgba(0,0,0,0.04)"><strong>${utils ? utils.escapeHtml(pr.desc) : pr.desc}</strong><div class="muted">Realizado por: ${utils ? utils.escapeHtml(pr.performedBy || '---') : (pr.performedBy||'---')} · ${new Date(pr.time).toLocaleString()}</div></div>`;
      });
      html += `</div>`;
    }

    html += `<hr /><div style="margin-top:10px"><button class="btn ghost" id="btn-close-admin-detail">Cerrar</button></div></div>`;
    if(modals && modals.openModalLarge) modals.openModalLarge(html);
    setTimeout(()=>{
      const btnClose = document.getElementById('btn-close-admin-detail');
      if(btnClose) btnClose.addEventListener('click', ()=> { if(modals && modals.closeModalLarge) modals.closeModalLarge(); });
    }, 10);
  }

  function openAdminAuditModal(patientId){
    const logs = (audit && audit.getAudit ? audit.getAudit() : []).filter(l=>{
      if(l.patientId && l.patientId === patientId) return true;
      try {
        const json = JSON.stringify(l.details || '');
        if(json && json.indexOf(patientId) !== -1) return true;
      } catch(e){}
      return false;
    });

    let html = `<div style="max-width:1000px">
      <h3>Historial de auditoría - paciente</h3>
      <div class="muted">Se muestran las acciones registradas (creación, actualizaciones, procedimientos, ediciones).</div>
      <div style="margin-top:12px">`;

    if(logs.length === 0) html += `<div class="muted">Sin registros de auditoría para este paciente</div>`;
    else {
      html += `<table style="width:100%;border-collapse:collapse"><thead><tr><th>Hora</th><th>Acción</th><th>Usuario</th><th>Detalles</th></tr></thead><tbody>`;
      logs.forEach(l=>{
        const time = l.time ? new Date(l.time).toLocaleString() : (l.timestamp ? new Date(l.timestamp).toLocaleString() : '-');
        const action = utils ? utils.escapeHtml(l.action || '-') : (l.action||'-');
        const user = utils ? utils.escapeHtml(l.user || '-') : (l.user||'-');
        const details = utils ? utils.escapeHtml(JSON.stringify(l.details || l || {}).slice(0,1000)) : JSON.stringify(l.details || l || {}).slice(0,1000);
        html += `<tr style="border-bottom:1px solid rgba(0,0,0,0.04)"><td style="vertical-align:top">${time}</td><td style="vertical-align:top">${action}</td><td style="vertical-align:top">${user}</td><td style="vertical-align:top"><pre style="white-space:pre-wrap;word-break:break-word;margin:0">${details}</pre></td></tr>`;
      });
      html += `</tbody></table>`;
    }

    html += `</div><div style="margin-top:12px"><button class="btn ghost" id="btn-close-admin-audit">Cerrar</button></div></div>`;
    if(modals && modals.openModalLarge) modals.openModalLarge(html);
    setTimeout(()=> {
      const close = document.getElementById('btn-close-admin-audit');
      if(close) close.addEventListener('click', ()=> { if(modals && modals.closeModalLarge) modals.closeModalLarge(); });
    }, 10);
  }

  /* ---------------------------
     Filter button UI
     --------------------------- */
  function setListFilter(mode){
    currentListFilter = mode;
    updateFilterButtonsUI();
    renderPatientList(searchInput ? searchInput.value.trim() : '');
    const sess = auth && auth.currentSession ? auth.currentSession() : null;
    if(sess && sess.role === 'admin' && panelStaff && !panelStaff.classList.contains('hidden')){
      renderAdminTable();
    }
  }
  function updateFilterButtonsUI(){
    if(!btnViewActive || !btnViewEgresados) return;
    btnViewActive.classList.remove('active');
    btnViewEgresados.classList.remove('active');
    if(currentListFilter === 'active') btnViewActive.classList.add('active');
    if(currentListFilter === 'discharged') btnViewEgresados.classList.add('active');
  }

  /* ---------------------------
     Cleanup UI when logging out
     --------------------------- */
  function handleLogoutUI(){
    if(panelStaff) panelStaff.classList.add('hidden');
    const loginModal = document.getElementById('modal-login');
    if(loginModal) loginModal.classList.add('hidden');
    if(modals && typeof modals.closeModalLarge === 'function') modals.closeModalLarge();
    if(patientDetailEl) patientDetailEl.innerHTML = '<div class="muted">Selecciona un paciente para ver detalles</div>';
    if(patientListEl) patientListEl.innerHTML = '';
    if(searchInput) searchInput.value = '';
    try{ renderPatientList(); }catch(e){}
  }

  /* ---------------------------
     Init: wire handlers and events
     --------------------------- */
  function init(){
    if(btnSearch) btnSearch.addEventListener('click', ()=> renderPatientList(searchInput ? searchInput.value.trim() : ''));
    if(searchInput) searchInput.addEventListener('keydown', (e)=> { if(e.key === 'Enter') renderPatientList(searchInput.value.trim()); });

    if(btnViewActive) btnViewActive.addEventListener('click', ()=> setListFilter('active'));
    if(btnViewEgresados) btnViewEgresados.addEventListener('click', ()=> setListFilter('discharged'));

    if(btnLogout) btnLogout.addEventListener('click', ()=> {
      try{ if(auth && auth.logout) auth.logout(); } catch(e){ console.warn(e); }
      handleLogoutUI();
    });

    // Listen to domain events to refresh UI
    window.addEventListener('eseb:patient:created', ()=> {
      renderPatientList(searchInput ? searchInput.value.trim() : '');
      const sess = auth && auth.currentSession ? auth.currentSession() : null;
      if(sess && sess.role === 'admin') renderAdminTable();
    });
    window.addEventListener('eseb:patient:updated', (ev)=> {
      renderPatientList(searchInput ? searchInput.value.trim() : '');
      const sess = auth && auth.currentSession ? auth.currentSession() : null;
      if(sess && sess.role === 'admin') renderAdminTable();
      const detailWrap = patientDetailEl && patientDetailEl.querySelector ? patientDetailEl.querySelector('[data-patient-id]') : null;
      if(detailWrap){
        const pid = detailWrap.getAttribute('data-patient-id');
        const p = patientsApi && patientsApi.getPatients ? patientsApi.getPatients().find(x=> x.id === pid) : null;
        if(p) showPatientDetail(pid);
      }
    });
    window.addEventListener('eseb:procedure:added', ()=> {
      const sess = auth && auth.currentSession ? auth.currentSession() : null;
      if(sess && sess.role === 'admin') renderAdminTable();
      renderPatientList(searchInput ? searchInput.value.trim() : '');
    });
    window.addEventListener('eseb:procedure:edited', ()=> {
      const sess = auth && auth.currentSession ? auth.currentSession() : null;
      if(sess && sess.role === 'admin') renderAdminTable();
      renderPatientList(searchInput ? searchInput.value.trim() : '');
    });
    window.addEventListener('eseb:audit:changed', ()=> {
      const sess = auth && auth.currentSession ? auth.currentSession() : null;
      if(sess && sess.role === 'admin') renderAdminTable();
    });

    // storage event (cross-tab) refresh
    window.addEventListener('eseb:storage', ()=> {
      renderPatientList(searchInput ? searchInput.value.trim() : '');
      const sess = auth && auth.currentSession ? auth.currentSession() : null;
      if(sess && sess.role === 'admin') renderAdminTable();
    });

    // initial render
    renderPatientList();
    const sess = auth && auth.currentSession ? auth.currentSession() : null;
    if(sess && sess.role === 'admin'){
      renderAdminTable();
    }
  }

  window.eseb = window.eseb || {};
  window.eseb.staffPanel = {
    init,
    renderPatientList,
    showPatientDetail,
    renderAdminTable
  };
})();
