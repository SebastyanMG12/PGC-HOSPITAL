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

  function updatePatient(id, patch, auditNote){
    const patients = getPatients();
    const idx = patients.findIndex(p=> p.id === id);
    if(idx === -1) throw new Error('Paciente no encontrado');
    const before = Object.assign({}, patients[idx]);
    patients[idx] = Object.assign({}, patients[idx], patch);
    savePatients(patients);
    if(auditNote){
      audit.logAudit(Object.assign({ patientId: id, user: (window.eseb.auth.currentSession() ? window.eseb.auth.currentSession().username : 'system') }, auditNote));
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
