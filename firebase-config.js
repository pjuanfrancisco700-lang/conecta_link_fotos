import {
  initializeApp,
  getApp,
  getApps
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import {
  getStorage
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

/**
 * CONFIGURACIÓN REAL DE FIREBASE
 * Proyecto: ConectaLink Fotos
 */
export const firebaseConfig = {
  apiKey: "AIzaSyBaxesEf3zPkk8ZknQHzAOnsZcrdQdLBKA",
  authDomain: "conectalink-fotos.firebaseapp.com",
  projectId: "conectalink-fotos",
  storageBucket: "conectalink-fotos.firebasestorage.app",
  messagingSenderId: "894298787599",
  appId: "1:894298787599:web:16c65606f26e0f661d387a",
  measurementId: "G-KLXLKXJ6MZ"
};

/**
 * Campos necesarios para que la aplicación pueda conectarse.
 * measurementId es opcional.
 */
const REQUIRED_FIELDS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId"
];

/**
 * Comprueba que la configuración de Firebase esté completa.
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
 * Inicializa Firebase una sola vez.
 * Devuelve Authentication, Storage y Firestore.
 */
export function initializeFirebaseServices() {
  const validation = validateFirebaseConfig(firebaseConfig);

  if (!validation.isValid) {
    const error = new Error("FIREBASE_CONFIG_INCOMPLETE");
    error.code = "app/config-incomplete";
    error.missingFields = validation.missingFields;
    throw error;
  }

  const app = getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

  const auth = getAuth(app);
  const storage = getStorage(app);
  const db = getFirestore(app);

  return {
    app,
    auth,
    storage,
    db
  };
}
