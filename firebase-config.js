import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

/**
 * CONFIGURACIÓN DE FIREBASE
 * Reemplaza únicamente los valores PEGAR_... con los datos reales de tu app web
 * en Firebase Console > Configuración del proyecto > Tus apps > SDK setup.
 */
export const firebaseConfig = {
  apiKey: "PEGAR_API_KEY",
  authDomain: "conectalink-fotos.firebaseapp.com",
  projectId: "conectalink-fotos",
  storageBucket: "conectalink-fotos.firebasestorage.app",
  messagingSenderId: "PEGAR_MESSAGING_SENDER_ID",
  appId: "PEGAR_APP_ID",
  measurementId: "PEGAR_MEASUREMENT_ID"
};

const REQUIRED_FIELDS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId"
];

/**
 * Comprueba que los datos esenciales existan y que no conserven marcadores.
 * measurementId es opcional y no impide iniciar la aplicación.
 */
export function validateFirebaseConfig(config = firebaseConfig) {
  const missingFields = REQUIRED_FIELDS.filter((field) => {
    const value = config[field];
    return (
      typeof value !== "string" ||
      value.trim() === "" ||
      value.includes("PEGAR_")
    );
  });

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Inicializa Firebase una sola vez y devuelve los servicios utilizados.
 */
export function initializeFirebaseServices() {
  const validation = validateFirebaseConfig(firebaseConfig);

  if (!validation.isValid) {
    const error = new Error("FIREBASE_CONFIG_INCOMPLETE");
    error.code = "app/config-incomplete";
    error.missingFields = validation.missingFields;
    throw error;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

  return {
    app,
    auth: getAuth(app),
    storage: getStorage(app),
    db: getFirestore(app)
  };
}
