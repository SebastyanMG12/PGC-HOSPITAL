// patients.js
(function(){
  const s = window.eseb && window.eseb.storage;
  const utils = window.eseb && window.eseb.utils;
  const audit = window.eseb && window.eseb.audit;
  if(!s || !utils || !audit) throw new Error('storage, utils and audit must be loaded before patients.js');

  function getPatients(){
    return s.read(s.STORAGE_KEYS.PATIENTS) || [];
  }
  function savePatients(list){
    s.write(s.STORAGE_KEYS.PATIENTS, list || []);
  }

  // Helper para calcular diff simple entre dos objetos (planos)
  function computeDiff(before, after){
    const diff = {};
    Object.keys(after).forEach(k => {
      const a = before && before[k];
      const b = after[k];
      // comparación sencilla: tratar null/undefined y stringify para objetos básicos
      const aStr = (a === undefined || a === null) ? '' : String(a);
      const bStr = (b === undefined || b === null) ? '' : String(b);
      if(aStr !== bStr) diff[k] = { before: a, after: b };
    });
    return diff;
  }

  function createPatient(data){
    const internalId = utils.uid('PINT');
    const publicCode = Math.random().toString(36).substr(2,7).toUpperCase();
    const patient = {
      id: utils.uid('patient'),
      internalId,
      publicCode,
      name: data.name,
      doc: data.doc || null,
      phone: data.phone || null,
      reason: data.reason || '',
      notes: data.notes || '',
      // campos nuevos: acompañante (opcionales)
      companionName: data.companionName || null,
      companionPhone: data.companionPhone || null,
      companionRelation: data.companionRelation || null,
      createdAt: utils.now(),
      arrived: false,
      arrivedAt: null,
      assignedRoom: null,
      assignedBed: null,
      attending: null,
      admittedAt: null,
      dischargedAt: null,
      procedures: [],
      shareWithCompanion: false
    };
    const patients = getPatients();
    patients.unshift(patient);
    savePatients(patients);
    audit.logAudit({ action:'create_patient', patientId: patient.id, details: { name: patient.name } });
    window.dispatchEvent(new CustomEvent('eseb:patient:created', { detail: patient }));
    return patient;
  }

  /**
   * updatePatient
   * - id: patient id
   * - patch: partial object with fields to update
   * - auditNote: optional object { action: '...', details: {...} } OR omitted
   * When auditNote omitted we automatically compute a diff and log it.
   */
  function updatePatient(id, patch, auditNote){
    const patients = getPatients();
    const idx = patients.findIndex(p=> p.id === id);
    if(idx === -1) throw new Error('Paciente no encontrado');
    const before = Object.assign({}, patients[idx]);
    // Normalize undefined -> null for the stored object
    const normalizedPatch = Object.keys(patch || {}).reduce((acc,k)=>{
      acc[k] = patch[k]===undefined ? null : patch[k];
      return acc;
    }, {});
    patients[idx] = Object.assign({}, patients[idx], normalizedPatch);
    savePatients(patients);

    // Auditoría: si viene auditNote úsalo, si no calcula diff automático
    if(auditNote && auditNote.action){
      audit.logAudit(Object.assign({
        patientId: id,
        user: (window.eseb.auth.currentSession() ? window.eseb.auth.currentSession().username : 'system'),
        time: utils.now()
      }, auditNote));
    } else {
      // compute diff
      const after = patients[idx];
      const diff = computeDiff(before, after);
      if(Object.keys(diff).length > 0){
        audit.logAudit({
          action: 'update_patient',
          patientId: id,
          user: (window.eseb.auth.currentSession() ? window.eseb.auth.currentSession().username : 'system'),
          details: { diff }
        });
      }
    }

    window.dispatchEvent(new CustomEvent('eseb:patient:updated', { detail: patients[idx] }));
    return patients[idx];
  }

  function findByPublicCode(code){
    if(!code) return null;
    const p = getPatients().find(x=> x.publicCode === code);
    return p || null;
  }

  window.eseb = window.eseb || {};
  window.eseb.patients = {
    getPatients,
    savePatients,
    createPatient,
    updatePatient,
    findByPublicCode
  };
})();
