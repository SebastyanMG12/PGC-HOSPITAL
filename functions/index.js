// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.setRole = functions.https.onCall(async (data, context) => {
  // 1) autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe autenticarse.");
  }

  // 2) verificar que quien llama sea admin por custom claim
  const callerClaims = context.auth.token || {};
  if (callerClaims.role !== "admin") {
    throw new functions.https.HttpsError(
        "permission-denied",
        "Necesita ser admin para asignar roles.",
    );
  }

  // 3) validar input
  const {uid, role} = data || {};
  if (!uid || !role) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Se requiere uid y role.",
    );
  }

  if (!["admin", "medico"].includes(role)) {
    throw new functions.https.HttpsError("invalid-argument", "Role inválido.");
  }

  try {
    // 4) setear custom claim en el usuario
    await admin.auth().setCustomUserClaims(uid, {role});

    // 5) escribir en firestore un registro de auditoría (no bloquear si falla)
    try {
      await admin.firestore().collection("audit").add({
        action: "setRole",
        uid,
        role,
        by: context.auth.uid,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn("audit write failed", e);
    }

    return {success: true, message: "Role asignado"};
  } catch (err) {
    console.error("setRole error", err);
    throw new functions.https.HttpsError("internal", "Error asignando rol");
  }
});
