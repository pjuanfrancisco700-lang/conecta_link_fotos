import {
  initializeFirebaseServices,
  validateFirebaseConfig,
  firebaseConfig
} from "./firebase-config.js";
import {
  browserLocalPersistence,
  setPersistence,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  ref as storageRef,
  uploadBytesResumable
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";
import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

/* ================================================================
   CONFIGURACIÓN DEL EVENTO
   Edita este objeto para reutilizar la app en otro evento.
   ================================================================ */
const EVENT_CONFIG = {
  eventoId: "boda-darwin-dilma",
  titulo: "Darwin & Dilma",
  subtitulo: "Comparte tus mejores momentos",
  mensaje: "Ayúdanos a guardar cada recuerdo de este día tan especial.",
  fecha: "1 de agosto de 2026",
  imagenPortada: "./assets/portada-evento.jpg?v=2",
  maxFotosPorEnvio: 20,
  maxPesoOriginalMB: 40,
  maxPesoProcesadoMB: 10
};

const MAX_PARALLEL_UPLOADS = 2;
const TARGET_LONG_SIDE = 1920;
const OUTPUT_QUALITY = 0.82;
const FIREBASE_RETRY_DELAY_MS = 800;
const TOAST_DURATION_MS = 4200;

const dom = {
  appShell: document.querySelector("#appShell"),
  appMain: document.querySelector("#appMain"),
  offlineBanner: document.querySelector("#offlineBanner"),
  authBadge: document.querySelector("#authBadge"),
  authBadgeText: document.querySelector("#authBadgeText"),
  initialLoader: document.querySelector("#initialLoader"),
  loaderText: document.querySelector("#loaderText"),
  toastRegion: document.querySelector("#toastRegion"),

  welcomeScreen: document.querySelector("#welcomeScreen"),
  uploadScreen: document.querySelector("#uploadScreen"),
  successScreen: document.querySelector("#successScreen"),

  eventCover: document.querySelector("#eventCover"),
  coverSkeleton: document.querySelector("#coverSkeleton"),
  eventTitle: document.querySelector("#eventTitle"),
  eventSubtitle: document.querySelector("#eventSubtitle"),
  eventDate: document.querySelector("#eventDate"),
  eventMessage: document.querySelector("#eventMessage"),
  startButton: document.querySelector("#startButton"),
  welcomeStatus: document.querySelector("#welcomeStatus"),

  uploadForm: document.querySelector("#uploadForm"),
  backButton: document.querySelector("#backButton"),
  guestName: document.querySelector("#guestName"),
  nameField: document.querySelector("#nameField"),
  nameError: document.querySelector("#nameError"),
  nameValidIcon: document.querySelector("#nameValidIcon"),
  photoPickerCard: document.querySelector(".photo-picker-card"),

  galleryButton: document.querySelector("#galleryButton"),
  cameraButton: document.querySelector("#cameraButton"),
  galleryInput: document.querySelector("#galleryInput"),
  cameraInput: document.querySelector("#cameraInput"),
  pickerHint: document.querySelector("#pickerHint"),
  selectionLimitBadge: document.querySelector("#selectionLimitBadge"),

  previewSection: document.querySelector("#previewSection"),
  previewGrid: document.querySelector("#previewGrid"),
  selectionSummary: document.querySelector("#selectionSummary"),
  selectionWeight: document.querySelector("#selectionWeight"),
  addMoreButton: document.querySelector("#addMoreButton"),

  progressSection: document.querySelector("#progressSection"),
  progressHeading: document.querySelector("#progressHeading"),
  progressPercentage: document.querySelector("#progressPercentage"),
  progressTrack: document.querySelector(".progress-track"),
  progressBar: document.querySelector("#progressBar"),
  progressText: document.querySelector("#progressText"),
  fileProgressList: document.querySelector("#fileProgressList"),

  bottomActionBar: document.querySelector("#bottomActionBar"),
  bottomCount: document.querySelector("#bottomCount"),
  bottomState: document.querySelector("#bottomState"),
  uploadButton: document.querySelector("#uploadButton"),
  uploadButtonLabel: document.querySelector("#uploadButtonLabel"),
  uploadButtonSpinner: document.querySelector("#uploadButtonSpinner"),
  uploadButtonIcon: document.querySelector("#uploadButtonIcon"),
  retryButton: document.querySelector("#retryButton"),
  retryButtonLabel: document.querySelector("#retryButtonLabel"),

  successGuestName: document.querySelector("#successGuestName"),
  successPhotoCount: document.querySelector("#successPhotoCount"),
  shareMoreButton: document.querySelector("#shareMoreButton"),
  returnHomeButton: document.querySelector("#returnHomeButton"),

  errorDialog: document.querySelector("#errorDialog"),
  errorDialogTitle: document.querySelector("#errorDialogTitle"),
  errorDialogMessage: document.querySelector("#errorDialogMessage"),
  errorDialogButton: document.querySelector("#errorDialogButton"),

  photoCardTemplate: document.querySelector("#photoCardTemplate"),
  fileProgressTemplate: document.querySelector("#fileProgressTemplate")
};

const state = {
  eventId: sanitizeEventId(EVENT_CONFIG.eventoId),
  firebaseReady: false,
  authReady: false,
  initializationInProgress: false,
  firebaseServices: null,
  user: null,
  isOnline: navigator.onLine,
  isUploading: false,
  registrationFailed: false,
  batchRegistered: false,
  selectedPhotos: [],
  activeScreen: "welcome",
  successName: "",
  successCount: 0,
  lastTouchEnd: 0,
  lastTouchTarget: null
};

/* ================================================================
   INICIO
   ================================================================ */

bootstrap();

async function bootstrap() {
  applyEventConfiguration();
  bindEvents();
  configureMobileViewport();
  configureZoomProtection();
  updateConnectionState();
  registerServiceWorker();
  updateSelectionUI();

  await initializeFirebase();
}

function applyEventConfiguration() {
  document.title = `${EVENT_CONFIG.titulo} · ConectaLink Fotos`;
  dom.eventTitle.textContent = EVENT_CONFIG.titulo;
  dom.eventSubtitle.textContent = EVENT_CONFIG.subtitulo;
  dom.eventDate.textContent = EVENT_CONFIG.fecha;
  dom.eventMessage.textContent = EVENT_CONFIG.mensaje;
  dom.eventCover.src = EVENT_CONFIG.imagenPortada;
  dom.eventCover.alt = `Portada de ${EVENT_CONFIG.titulo}`;
  dom.selectionLimitBadge.textContent = `0 / ${EVENT_CONFIG.maxFotosPorEnvio}`;
  dom.pickerHint.textContent =
  `Puedes seleccionar hasta ${EVENT_CONFIG.maxFotosPorEnvio} fotografías. Las imágenes grandes se optimizan automáticamente.`;
}

function bindEvents() {
  dom.eventCover.addEventListener("load", handleCoverLoaded);
  dom.eventCover.addEventListener("error", handleCoverError);
  if (dom.eventCover.complete && dom.eventCover.naturalWidth > 0) {
    handleCoverLoaded();
  }

  dom.startButton.addEventListener("click", () => {
    if (!state.firebaseReady || !state.authReady) {
      showToast("La conexión segura todavía se está preparando.", "warning");
      return;
    }
    showScreen("upload");
    window.setTimeout(() => dom.guestName.focus({ preventScroll: false }), 260);
  });

  dom.backButton.addEventListener("click", handleBackToWelcome);
  dom.returnHomeButton.addEventListener("click", handleReturnHome);
  dom.shareMoreButton.addEventListener("click", handleShareMore);

  dom.galleryButton.addEventListener("click", () => openFilePicker(dom.galleryInput));
  dom.cameraButton.addEventListener("click", () => openFilePicker(dom.cameraInput));
  dom.addMoreButton.addEventListener("click", () => openFilePicker(dom.galleryInput));

  dom.galleryInput.addEventListener("change", handleFileInputChange);
  dom.cameraInput.addEventListener("change", handleFileInputChange);

  dom.guestName.addEventListener("input", handleNameInput);
  dom.guestName.addEventListener("keydown", handleNameKeyboardAction);
  dom.guestName.addEventListener("blur", () => {
    const cleaned = sanitizeGuestName(dom.guestName.value);
    dom.guestName.value = cleaned;
    validateAndRenderName(true);
    updateActionState();
  });

  dom.uploadForm.addEventListener("submit", handleUploadSubmit);
  dom.retryButton.addEventListener("click", handleRetry);
  dom.errorDialogButton.addEventListener("click", hideErrorDialog);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  window.addEventListener("beforeunload", handleBeforeUnload);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  document.addEventListener("contextmenu", (event) => {
    if (event.target instanceof HTMLImageElement) {
      event.preventDefault();
    }
  });

  document.addEventListener("dragstart", (event) => {
    if (event.target instanceof HTMLImageElement) {
      event.preventDefault();
    }
  });
}

async function initializeFirebase() {
  if (state.initializationInProgress || (state.firebaseReady && state.authReady)) {
    return;
  }

  state.initializationInProgress = true;
  setLoaderMessage("Preparando tu espacio…");
  updateAuthBadge("Preparando", "pending");
  dom.welcomeStatus.textContent = "Preparando tu espacio…";

  const configValidation = validateFirebaseConfig(firebaseConfig);
  if (!configValidation.isValid) {
    state.initializationInProgress = false;
    state.firebaseReady = false;
    state.authReady = false;
    finishInitialLoading();
    updateAuthBadge("Configurar Firebase", "error");
    dom.welcomeStatus.textContent = "Falta completar la configuración de Firebase.";
    showErrorDialog(
      "Firebase no está configurado",
      "Abre firebase-config.js y reemplaza los valores PEGAR_… con la configuración real de tu aplicación web en Firebase."
    );
    updateActionState();
    return;
  }

  if (!navigator.onLine) {
    state.initializationInProgress = false;
    finishInitialLoading();
    updateAuthBadge("Sin conexión", "error");
    dom.welcomeStatus.textContent = "Conéctate a internet para iniciar la sesión segura.";
    updateActionState();
    return;
  }

  try {
    setLoaderMessage("Conectando de forma segura…");
    state.firebaseServices = initializeFirebaseServices();
    state.firebaseReady = true;

    try {
      await setPersistence(state.firebaseServices.auth, browserLocalPersistence);
    } catch (persistenceError) {
      console.warn("No se pudo establecer persistencia local de Authentication.", persistenceError);
    }

    const credential = await signInAnonymously(state.firebaseServices.auth);
    state.user = credential.user;
    state.authReady = Boolean(credential.user?.uid);

    if (!state.authReady) {
      throw createAppError("auth/no-user", "La sesión anónima no devolvió un usuario válido.");
    }

    updateAuthBadge("Conexión segura", "ready");
    dom.welcomeStatus.textContent = "Todo listo para compartir tus fotografías.";
    setLoaderMessage("Todo listo");
    await delay(260);
    finishInitialLoading();
  } catch (error) {
    console.error("Error al iniciar Firebase:", error);
    state.firebaseReady = Boolean(state.firebaseServices);
    state.authReady = false;
    state.user = null;
    updateAuthBadge("No conectado", "error");
    dom.welcomeStatus.textContent = getFriendlyErrorMessage(error, "init");
    finishInitialLoading();
    showErrorDialog("No pudimos iniciar la conexión", getFriendlyErrorMessage(error, "init"));
  } finally {
    state.initializationInProgress = false;
    updateActionState();
  }
}

function finishInitialLoading() {
  dom.initialLoader.classList.add("is-hidden");
  dom.appShell.setAttribute("aria-busy", "false");
}

function setLoaderMessage(message) {
  dom.loaderText.textContent = message;
}

function updateAuthBadge(text, status) {
  dom.authBadgeText.textContent = text;
  dom.authBadge.classList.toggle("is-ready", status === "ready");
  dom.authBadge.classList.toggle("is-error", status === "error");
}

/* ================================================================
   NAVEGACIÓN Y PANTALLAS
   ================================================================ */

function showScreen(screenName) {
  const screens = {
    welcome: dom.welcomeScreen,
    upload: dom.uploadScreen,
    success: dom.successScreen
  };

  Object.entries(screens).forEach(([name, element]) => {
    const isActive = name === screenName;
    element.hidden = !isActive;
    element.classList.toggle("is-active", isActive);
  });

  state.activeScreen = screenName;
  dom.bottomActionBar.hidden = screenName !== "upload";
  dom.appShell.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

function handleBackToWelcome() {
  if (state.isUploading) {
    showToast("Espera a que termine la carga antes de salir.", "warning");
    return;
  }

  if (hasUnregisteredCompletedPhotos()) {
    showToast("Primero reintenta las fotografías pendientes para completar este envío.", "warning");
    return;
  }

  showScreen("welcome");
}

function handleReturnHome() {
  dom.guestName.value = "";
  clearNameValidation();
  showScreen("welcome");
}

function handleShareMore() {
  showScreen("upload");
  updateSelectionUI();
  window.setTimeout(() => {
    if (dom.guestName.value.trim()) {
      dom.galleryButton.focus({ preventScroll: true });
    } else {
      dom.guestName.focus({ preventScroll: true });
    }
  }, 220);
}

function scrollToWorkflowSection(element, delay = 180) {
  if (!element) {
    return;
  }

  window.setTimeout(() => {
    if (
      element.hidden ||
      state.activeScreen !== "upload" ||
      !document.documentElement.contains(element)
    ) {
      return;
    }

    window.requestAnimationFrame(() => {
      const shellRect = dom.appShell.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const targetTop = Math.max(
        0,
        dom.appShell.scrollTop + elementRect.top - shellRect.top - 12
      );

      dom.appShell.scrollTo({
        top: targetTop,
        behavior: prefersReducedMotion() ? "auto" : "smooth"
      });
    });
  }, delay);
}

/* ================================================================
   NOMBRE DEL INVITADO
   ================================================================ */

function handleNameKeyboardAction(event) {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();

  if (state.isUploading || hasUnregisteredCompletedPhotos()) {
    return;
  }

  const validation = validateAndRenderName(true);

  if (!validation.isValid) {
    return;
  }

  dom.guestName.value = validation.cleaned;
  updateActionState();

  // Cierra el teclado antes de avanzar a la siguiente tarjeta.
  dom.guestName.blur();
  scrollToWorkflowSection(dom.photoPickerCard, 320);
}

function handleNameInput() {
  if (state.isUploading || hasUnregisteredCompletedPhotos()) {
    return;
  }

  if (dom.guestName.value.length > 80) {
    dom.guestName.value = dom.guestName.value.slice(0, 80);
  }

  validateAndRenderName(false);
  updateActionState();
}

function sanitizeGuestName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function validateGuestName(value) {
  const cleaned = sanitizeGuestName(value);

  if (!cleaned) {
    return { isValid: false, cleaned, message: "Escribe tu nombre para continuar." };
  }

  if (cleaned.length < 2) {
    return { isValid: false, cleaned, message: "El nombre debe tener al menos 2 caracteres." };
  }

  if (cleaned.length > 80) {
    return { isValid: false, cleaned, message: "El nombre no puede superar 80 caracteres." };
  }

  if (!/[\p{L}\p{N}]/u.test(cleaned)) {
    return { isValid: false, cleaned, message: "El nombre debe incluir letras o números, no solamente símbolos." };
  }

  return { isValid: true, cleaned, message: "" };
}

function validateAndRenderName(forceError) {
  const validation = validateGuestName(dom.guestName.value);
  const shouldShowError = forceError && !validation.isValid;

  dom.nameField.classList.toggle("is-invalid", shouldShowError);
  dom.nameError.hidden = !shouldShowError;
  dom.nameError.textContent = shouldShowError ? validation.message : "";
  dom.nameValidIcon.hidden = !validation.isValid;

  return validation;
}

function clearNameValidation() {
  dom.nameField.classList.remove("is-invalid");
  dom.nameError.hidden = true;
  dom.nameError.textContent = "";
  dom.nameValidIcon.hidden = true;
}

/* ================================================================
   SELECCIÓN Y VISTA PREVIA
   ================================================================ */

function openFilePicker(input) {
  if (state.isUploading) {
    return;
  }

  if (hasUnregisteredCompletedPhotos()) {
    showToast("Completa el envío actual antes de agregar más fotografías.", "warning");
    return;
  }

  if (state.selectedPhotos.length >= EVENT_CONFIG.maxFotosPorEnvio) {
    showToast(`Ya seleccionaste el máximo de ${EVENT_CONFIG.maxFotosPorEnvio} fotografías.`, "warning");
    return;
  }

  input.click();
}

function handleFileInputChange(event) {
  const input = event.currentTarget;
  const files = Array.from(input.files ?? []);
  input.value = "";

  if (files.length === 0 || state.isUploading) {
    return;
  }

  addSelectedFiles(files);
}

function addSelectedFiles(files) {
  const existingKeys = new Set(state.selectedPhotos.map((photo) => photo.duplicateKey));
  const availableSlots = Math.max(0, EVENT_CONFIG.maxFotosPorEnvio - state.selectedPhotos.length);
  const accepted = [];
  const rejected = [];

  for (const file of files) {
    if (accepted.length >= availableSlots) {
      rejected.push({ file, reason: `Solo puedes enviar ${EVENT_CONFIG.maxFotosPorEnvio} fotografías por vez.` });
      continue;
    }

    const validation = validateImageFile(file, existingKeys);
    if (!validation.isValid) {
      rejected.push({ file, reason: validation.message });
      continue;
    }

    const photo = createPhotoItem(file, validation.duplicateKey);
    accepted.push(photo);
    existingKeys.add(validation.duplicateKey);
  }

  if (accepted.length > 0) {
    state.selectedPhotos.push(...accepted);
    renderPhotoCards(accepted);
    updateSelectionUI();
    vibrate(18);
    showToast(
      accepted.length === 1
        ? "Fotografía agregada a la selección."
        : `${accepted.length} fotografías agregadas a la selección.`,
      "success"
    );

    scrollToWorkflowSection(dom.previewSection, 220);
  }

  if (rejected.length > 0) {
    showRejectedFilesNotice(rejected);
  }
}

function validateImageFile(file, existingKeys) {
  const maxBytes = megabytesToBytes(EVENT_CONFIG.maxPesoOriginalMB);
  const extension = getFileExtension(file.name);
  const knownImageExtensions = new Set([
    "jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif", "avif", "tif", "tiff"
  ]);
  const isImageType = typeof file.type === "string" && file.type.startsWith("image/");
  const isKnownImageExtension = knownImageExtensions.has(extension);

  if (!isImageType && !isKnownImageExtension) {
    return { isValid: false, message: "El archivo no tiene un formato de imagen permitido." };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { isValid: false, message: "La fotografía está vacía o no se pudo leer." };
  }

  if (file.size > maxBytes) {
  return {
    isValid: false,
    message: `La fotografía pesa más de ${EVENT_CONFIG.maxPesoOriginalMB} MB y es demasiado grande para procesarla en este dispositivo.`
  };
}

  const duplicateKey = createDuplicateKey(file);
  if (existingKeys.has(duplicateKey)) {
    return { isValid: false, message: "Esta fotografía ya está dentro de la selección." };
  }

  return { isValid: true, duplicateKey };
}

function createPhotoItem(file, duplicateKey) {
  return {
    id: createUniqueId(),
    duplicateKey,
    file,
    previewUrl: URL.createObjectURL(file),
    status: "pending",
    progress: 0,
    bytesTransferred: 0,
    uploadTotalBytes: file.size,
    errorMessage: "",
    processedBlob: null,
    uploadMetadata: null,
    uploadFileName: ""
  };
}

function renderPhotoCards(photos) {
  const fragment = document.createDocumentFragment();

  photos.forEach((photo) => {
    const card = dom.photoCardTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.photoId = photo.id;

    const image = card.querySelector(".photo-thumb");
    const fallback = card.querySelector(".photo-fallback");
    const removeButton = card.querySelector(".photo-remove");
    const name = card.querySelector(".photo-name");
    const size = card.querySelector(".photo-size");

    image.src = photo.previewUrl;
    image.alt = `Vista previa de ${photo.file.name}`;
    image.addEventListener("error", () => {
      image.hidden = true;
      fallback.hidden = false;
    }, { once: true });

    removeButton.dataset.photoId = photo.id;
    removeButton.setAttribute("aria-label", `Eliminar ${photo.file.name}`);
    removeButton.addEventListener("click", () => removePhoto(photo.id));

    name.textContent = photo.file.name;
    size.textContent = formatBytes(photo.file.size);

    fragment.append(card);
  });

  dom.previewGrid.append(fragment);
}

function removePhoto(photoId) {
  if (state.isUploading || hasUnregisteredCompletedPhotos()) {
    return;
  }

  const index = state.selectedPhotos.findIndex((photo) => photo.id === photoId);
  if (index === -1) {
    return;
  }

  const [photo] = state.selectedPhotos.splice(index, 1);
  releasePhotoResources(photo);

  const card = dom.previewGrid.querySelector(`[data-photo-id="${cssEscape(photoId)}"]`);
  card?.remove();

  updateSelectionUI();
  showToast("Fotografía eliminada de la selección.");
}

function updateSelectionUI() {
  const count = state.selectedPhotos.length;
  const totalBytes = state.selectedPhotos.reduce((sum, photo) => sum + photo.file.size, 0);
  const max = EVENT_CONFIG.maxFotosPorEnvio;

  dom.previewSection.hidden = count === 0;
  dom.selectionLimitBadge.textContent = `${count} / ${max}`;
  dom.selectionLimitBadge.classList.toggle("is-full", count >= max);
  dom.selectionSummary.textContent = count === 1 ? "1 fotografía" : `${count} fotografías`;
  dom.selectionWeight.textContent = `${formatBytes(totalBytes)} aproximadamente`;
  dom.bottomCount.textContent = count === 1 ? "1 foto" : `${count} fotos`;

  if (state.isUploading) {
    dom.bottomState.textContent = "Envío en curso";
  } else if (state.registrationFailed) {
    dom.bottomState.textContent = "Falta confirmar el registro";
  } else if (state.selectedPhotos.some((photo) => photo.status === "error")) {
    const failed = state.selectedPhotos.filter((photo) => photo.status === "error").length;
    dom.bottomState.textContent = `${failed} pendiente${failed === 1 ? "" : "s"} de reintento`;
  } else if (count > 0) {
    dom.bottomState.textContent = "Listas para compartir";
  } else {
    dom.bottomState.textContent = "Agrega tus recuerdos";
  }

  updatePhotoCardStates();
  updateActionState();
}

function updatePhotoCardStates() {
  state.selectedPhotos.forEach((photo) => {
    const card = dom.previewGrid.querySelector(`[data-photo-id="${cssEscape(photo.id)}"]`);
    if (!card) {
      return;
    }

    const removeButton = card.querySelector(".photo-remove");
    const badge = card.querySelector(".photo-status-badge");
    removeButton.disabled = state.isUploading || photo.status === "completed" || hasUnregisteredCompletedPhotos();

    const statusLabel = getPhotoStatusLabel(photo);
    badge.hidden = !statusLabel;
    badge.textContent = statusLabel;
    badge.classList.toggle("is-completed", photo.status === "completed");
    badge.classList.toggle("is-error", photo.status === "error");
  });
}

function getPhotoStatusLabel(photo) {
  switch (photo.status) {
    case "compressing":
      return "Optimizando…";
    case "uploading":
      return `${Math.round(photo.progress)}% subido`;
    case "completed":
      return "Completada";
    case "error":
      return "Error · reintentar";
    default:
      return "";
  }
}

function showRejectedFilesNotice(rejected) {
  const first = rejected[0];
  const extraCount = rejected.length - 1;
  const prefix = first.file?.name ? `${truncateText(first.file.name, 24)}: ` : "";
  const suffix = extraCount > 0 ? ` Además, se rechazaron ${extraCount} archivo${extraCount === 1 ? "" : "s"}.` : "";
  showToast(`${prefix}${first.reason}${suffix}`, "warning", 6000);
}

/* ================================================================
   CARGA Y PROGRESO
   ================================================================ */

async function handleUploadSubmit(event) {
  event.preventDefault();

  if (state.isUploading) {
    return;
  }

  const readiness = validateUploadReadiness(true);
  if (!readiness.isValid) {
    showToast(readiness.message, "warning");
    return;
  }

  await startUpload(state.selectedPhotos.filter((photo) => photo.status !== "completed"));
}

async function handleRetry() {
  if (state.isUploading) {
    return;
  }

  if (!navigator.onLine) {
    showToast("Necesitas conexión para reintentar el envío.", "warning");
    return;
  }

  if (state.registrationFailed && state.selectedPhotos.every((photo) => photo.status === "completed")) {
    await retryFirestoreRegistration();
    return;
  }

  const failedPhotos = state.selectedPhotos.filter((photo) => photo.status === "error");
  if (failedPhotos.length === 0) {
    return;
  }

  failedPhotos.forEach((photo) => {
    photo.status = "pending";
    photo.progress = 0;
    photo.bytesTransferred = 0;
    photo.errorMessage = "";
  });

  const retryTargets = state.selectedPhotos.filter((photo) => photo.status !== "completed");
  await startUpload(retryTargets);
}

function validateUploadReadiness(showNameError) {
  const nameValidation = validateAndRenderName(showNameError);

  if (!state.firebaseReady) {
    return { isValid: false, message: "Firebase todavía no está listo." };
  }

  if (!state.authReady || !state.user?.uid) {
    return { isValid: false, message: "La sesión segura no está iniciada." };
  }

  if (!navigator.onLine) {
    return { isValid: false, message: "No hay conexión a internet para subir las fotografías." };
  }

  if (!nameValidation.isValid) {
    return { isValid: false, message: nameValidation.message };
  }

  if (state.selectedPhotos.length === 0) {
    return { isValid: false, message: "Selecciona al menos una fotografía." };
  }

  if (state.selectedPhotos.length > EVENT_CONFIG.maxFotosPorEnvio) {
    return { isValid: false, message: `El máximo es de ${EVENT_CONFIG.maxFotosPorEnvio} fotografías.` };
  }

  if (state.isUploading) {
    return { isValid: false, message: "Ya hay una carga en curso." };
  }

  return { isValid: true, message: "", guestName: nameValidation.cleaned };
}

async function startUpload(targetPhotos) {
  if (targetPhotos.length === 0) {
    return;
  }

  const nameValidation = validateGuestName(dom.guestName.value);
  if (!nameValidation.isValid) {
    validateAndRenderName(true);
    return;
  }

  state.isUploading = true;
  state.registrationFailed = false;
  state.batchRegistered = false;
  dom.guestName.value = nameValidation.cleaned;

  prepareProgressUI();
  setUploadingControls(true);
  updateSelectionUI();
  vibrate(22);

  const workers = Math.min(MAX_PARALLEL_UPLOADS, targetPhotos.length);
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < targetPhotos.length) {
      const photo = targetPhotos[cursor];
      cursor += 1;
      await processAndUploadPhoto(photo, nameValidation.cleaned);
    }
  };

  try {
    await Promise.all(Array.from({ length: workers }, () => runWorker()));

    const completedCount = state.selectedPhotos.filter((photo) => photo.status === "completed").length;
    const failedCount = state.selectedPhotos.filter((photo) => photo.status === "error").length;

    if (failedCount > 0) {
      state.isUploading = false;
      setUploadingControls(false);
      updateOverallProgress();
      updateSelectionUI();
      dom.progressHeading.textContent = "Algunas fotografías necesitan reintento";
      dom.progressText.textContent = `${completedCount} se subieron correctamente y ${failedCount} fallaron. No se registró un envío incompleto.`;
      showToast(`${failedCount} fotografía${failedCount === 1 ? "" : "s"} no pudieron subirse.`, "error", 6000);
      return;
    }

    dom.progressHeading.textContent = "Guardando la confirmación";
    dom.progressText.textContent = "Las fotografías ya se subieron. Estamos finalizando el registro del envío.";
    await registerCompletedUpload(nameValidation.cleaned);
  } catch (error) {
    console.error("Error general durante la carga:", error);
    state.isUploading = false;
    setUploadingControls(false);
    updateSelectionUI();
    showToast(getFriendlyErrorMessage(error, "upload"), "error", 6000);
  }
}

async function processAndUploadPhoto(photo, guestName) {
  try {
    photo.status = "compressing";
    photo.progress = 0;
    photo.errorMessage = "";
    updatePhotoProgressUI(photo);
    updateOverallProgress();

    const prepared = await optimizeImage(photo.file);
    photo.processedBlob = prepared.blob;
    photo.uploadTotalBytes = prepared.blob.size;

    if (prepared.blob.size > megabytesToBytes(EVENT_CONFIG.maxPesoProcesadoMB)) {
  throw createAppError(
    "file/too-large-after-processing",
    `La fotografía sigue superando ${EVENT_CONFIG.maxPesoProcesadoMB} MB después de optimizarla.`
  );
}

    const uniqueFileName = createUniqueFileName(photo.file.name, prepared.extension);
    photo.uploadFileName = uniqueFileName;
    photo.uploadMetadata = {
      contentType: prepared.contentType,
      customMetadata: {
        nombreInvitado: guestName,
        eventoId: state.eventId,
        usuarioId: state.user.uid,
        fechaCarga: new Date().toISOString()
      }
    };

    const guestFolder = createGuestFolderName(guestName, state.user.uid);
    const path = `eventos/${state.eventId}/${guestFolder}/${uniqueFileName}`;
    const targetRef = storageRef(state.firebaseServices.storage, path);

    photo.status = "uploading";
    updatePhotoProgressUI(photo);
    updateOverallProgress();

    await uploadBlobWithProgress(photo, targetRef);

    photo.status = "completed";
    photo.progress = 100;
    photo.bytesTransferred = photo.uploadTotalBytes;
    photo.errorMessage = "";
    photo.processedBlob = null;
    photo.uploadMetadata = null;
    updatePhotoProgressUI(photo);
    updatePhotoCardStates();
    updateOverallProgress();
  } catch (error) {
    console.error(`Error al subir ${photo.file.name}:`, error);
    photo.status = "error";
    photo.progress = 0;
    photo.bytesTransferred = 0;
    photo.errorMessage = getFriendlyErrorMessage(error, "upload");
    photo.processedBlob = null;
    photo.uploadMetadata = null;
    updatePhotoProgressUI(photo);
    updatePhotoCardStates();
    updateOverallProgress();
  }
}

function uploadBlobWithProgress(photo, targetRef) {
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(
      targetRef,
      photo.processedBlob,
      photo.uploadMetadata
    );

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        photo.bytesTransferred = snapshot.bytesTransferred;
        photo.uploadTotalBytes = snapshot.totalBytes || photo.uploadTotalBytes;
        photo.progress = snapshot.totalBytes > 0
          ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          : 0;
        updatePhotoProgressUI(photo);
        updatePhotoCardStates();
        updateOverallProgress();
      },
      (error) => reject(error),
      () => resolve(uploadTask.snapshot)
    );
  });
}

async function registerCompletedUpload(guestName) {
  try {
    const completedPhotos = state.selectedPhotos.filter((photo) => photo.status === "completed");
    const failedPhotos = state.selectedPhotos.filter((photo) => photo.status === "error");

    if (failedPhotos.length > 0 || completedPhotos.length !== state.selectedPhotos.length) {
      throw createAppError("firestore/incomplete-batch", "No se puede registrar un envío incompleto.");
    }

    await addDoc(collection(state.firebaseServices.db, "subidas"), {
      usuarioId: state.user.uid,
      eventoId: state.eventId,
      nombreInvitado: guestName,
      cantidadFotos: Number.parseInt(String(completedPhotos.length), 10),
      creadoEn: serverTimestamp()
    });

    state.batchRegistered = true;
    state.registrationFailed = false;
    state.isUploading = false;
    state.successName = guestName;
    state.successCount = completedPhotos.length;

    dom.progressHeading.textContent = "Envío completado";
    dom.progressText.textContent = "Todas las fotografías quedaron guardadas correctamente.";
    setUploadingControls(false);
    updateOverallProgress();
    vibrate([35, 45, 35]);

    showSuccessScreen();
  } catch (error) {
    console.error("Las fotos subieron, pero falló el registro en Firestore:", error);
    state.isUploading = false;
    state.registrationFailed = true;
    state.batchRegistered = false;
    setUploadingControls(false);
    updateSelectionUI();
    dom.progressHeading.textContent = "Las fotos subieron, falta confirmar";
    dom.progressText.textContent = "No volveremos a subir las fotografías. Presiona el botón para completar únicamente el registro del envío.";
    showToast(getFriendlyErrorMessage(error, "firestore"), "error", 7000);
  }
}

async function retryFirestoreRegistration() {
  const nameValidation = validateGuestName(dom.guestName.value);
  if (!nameValidation.isValid || !state.authReady || !navigator.onLine) {
    showToast("Revisa tu conexión y el nombre antes de completar la confirmación.", "warning");
    return;
  }

  state.isUploading = true;
  setUploadingControls(true);
  dom.progressHeading.textContent = "Completando confirmación";
  dom.progressText.textContent = "Las fotografías no se volverán a subir.";

  await registerCompletedUpload(nameValidation.cleaned);
}

function prepareProgressUI() {
  dom.progressSection.hidden = false;
  dom.fileProgressList.replaceChildren();
  dom.progressHeading.textContent = "Preparando fotografías";
  dom.progressText.textContent = "Optimizando y subiendo con una conexión segura.";
  dom.progressPercentage.textContent = "0%";
  dom.progressBar.style.width = "0%";
  dom.progressTrack.setAttribute("aria-valuenow", "0");

  const fragment = document.createDocumentFragment();
  state.selectedPhotos.forEach((photo) => {
    const item = dom.fileProgressTemplate.content.firstElementChild.cloneNode(true);
    item.dataset.photoId = photo.id;
    item.dataset.status = photo.status;
    item.querySelector(".file-progress-name").textContent = photo.file.name;
    fragment.append(item);
  });
  dom.fileProgressList.append(fragment);

  state.selectedPhotos.forEach(updatePhotoProgressUI);

  scrollToWorkflowSection(dom.progressSection, 100);
}

function updatePhotoProgressUI(photo) {
  const item = dom.fileProgressList.querySelector(`[data-photo-id="${cssEscape(photo.id)}"]`);
  if (!item) {
    return;
  }

  item.dataset.status = photo.status;
  const status = item.querySelector(".file-progress-status");
  const percent = item.querySelector(".file-progress-percent");
  const icon = item.querySelector(".file-state-icon");

  status.textContent = getDetailedStatusLabel(photo);
  percent.textContent = photo.status === "compressing"
    ? "…"
    : `${Math.round(photo.progress)}%`;
  icon.textContent = getStatusSymbol(photo.status);
}

function getDetailedStatusLabel(photo) {
  switch (photo.status) {
    case "pending":
      return "Pendiente";
    case "compressing":
      return "Comprimiendo";
    case "uploading":
      return "Subiendo";
    case "completed":
      return "Completada";
    case "error":
      return photo.errorMessage || "Error";
    default:
      return "Pendiente";
  }
}

function getStatusSymbol(status) {
  switch (status) {
    case "compressing":
      return "◌";
    case "uploading":
      return "↑";
    case "completed":
      return "✓";
    case "error":
      return "!";
    default:
      return "○";
  }
}

function updateOverallProgress() {
  if (state.selectedPhotos.length === 0) {
    dom.progressPercentage.textContent = "0%";
    dom.progressBar.style.width = "0%";
    dom.progressTrack.setAttribute("aria-valuenow", "0");
    return;
  }

  const weighted = state.selectedPhotos.reduce((sum, photo) => {
    let ratio = 0;
    if (photo.status === "completed") {
      ratio = 1;
    } else if (photo.status === "uploading") {
      ratio = Math.max(0, Math.min(1, photo.progress / 100));
    } else if (photo.status === "compressing") {
      ratio = 0.025;
    }
    return sum + ratio;
  }, 0);

  const percentage = Math.round((weighted / state.selectedPhotos.length) * 100);
  const completed = state.selectedPhotos.filter((photo) => photo.status === "completed").length;
  const uploading = state.selectedPhotos.filter((photo) => photo.status === "uploading").length;
  const currentNumber = Math.min(state.selectedPhotos.length, completed + uploading);

  dom.progressPercentage.textContent = `${percentage}%`;
  dom.progressBar.style.width = `${percentage}%`;
  dom.progressTrack.setAttribute("aria-valuenow", String(percentage));

  if (state.isUploading && uploading > 0) {
    dom.progressHeading.textContent = "Compartiendo fotografías";
    dom.progressText.textContent = `Subiendo ${Math.max(1, currentNumber)} de ${state.selectedPhotos.length} fotografías.`;
  }
}

function setUploadingControls(isUploading) {
  dom.guestName.disabled = isUploading || hasUnregisteredCompletedPhotos();
  dom.galleryButton.disabled = isUploading || hasUnregisteredCompletedPhotos();
  dom.cameraButton.disabled = isUploading || hasUnregisteredCompletedPhotos();
  dom.addMoreButton.disabled = isUploading || hasUnregisteredCompletedPhotos();
  dom.backButton.disabled = isUploading;
  dom.uploadButtonSpinner.hidden = !isUploading;
  dom.uploadButtonIcon.hidden = isUploading;
  dom.uploadButtonLabel.textContent = isUploading ? "Compartiendo…" : "Compartir fotografías";

  updatePhotoCardStates();
  updateActionState();
}

function updateActionState() {
  const nameValidation = validateGuestName(dom.guestName.value);
  const hasPendingPhotos = state.selectedPhotos.some((photo) => photo.status === "pending");
  const failedPhotos = state.selectedPhotos.filter((photo) => photo.status === "error");
  const allCompleted = state.selectedPhotos.length > 0 && state.selectedPhotos.every((photo) => photo.status === "completed");
  const canUpload =
    state.firebaseReady &&
    state.authReady &&
    navigator.onLine &&
    nameValidation.isValid &&
    state.selectedPhotos.length > 0 &&
    hasPendingPhotos &&
    !state.isUploading &&
    !hasUnregisteredCompletedPhotos();

  dom.startButton.disabled = !(state.firebaseReady && state.authReady);
  dom.uploadButton.disabled = !canUpload;
  dom.uploadButton.hidden = failedPhotos.length > 0 || state.registrationFailed;

  dom.retryButton.hidden = !(failedPhotos.length > 0 || state.registrationFailed);
  dom.retryButton.disabled = state.isUploading || !navigator.onLine || !state.authReady;

  if (state.registrationFailed && allCompleted) {
    dom.retryButtonLabel.textContent = "Completar confirmación";
  } else if (failedPhotos.length > 0) {
    dom.retryButtonLabel.textContent = failedPhotos.length === 1
      ? "Reintentar 1 fotografía"
      : `Reintentar ${failedPhotos.length} fotografías`;
  }

  const lockBatch = hasUnregisteredCompletedPhotos();
  dom.guestName.disabled = state.isUploading || lockBatch;
  dom.galleryButton.disabled = state.isUploading || lockBatch;
  dom.cameraButton.disabled = state.isUploading || lockBatch;
  dom.addMoreButton.disabled = state.isUploading || lockBatch || state.selectedPhotos.length >= EVENT_CONFIG.maxFotosPorEnvio;
}

function showSuccessScreen() {
  dom.successGuestName.textContent = state.successName;
  dom.successPhotoCount.textContent = String(state.successCount);
  showScreen("success");
  showToast("¡Fotografías compartidas correctamente!", "success");

  clearSelectedPhotos({ preserveName: true, preserveSuccess: true });
}

function clearSelectedPhotos({ preserveName = true, preserveSuccess = false } = {}) {
  state.selectedPhotos.forEach(releasePhotoResources);
  state.selectedPhotos = [];
  dom.previewGrid.replaceChildren();
  dom.fileProgressList.replaceChildren();
  dom.previewSection.hidden = true;
  dom.progressSection.hidden = true;
  state.registrationFailed = false;
  state.batchRegistered = false;
  state.isUploading = false;

  if (!preserveName) {
    dom.guestName.value = "";
    clearNameValidation();
  }

  if (!preserveSuccess) {
    state.successName = "";
    state.successCount = 0;
  }

  setUploadingControls(false);
  updateSelectionUI();
}

function hasUnregisteredCompletedPhotos() {
  return !state.batchRegistered && state.selectedPhotos.some((photo) => photo.status === "completed");
}

/* ================================================================
   OPTIMIZACIÓN DE IMÁGENES
   ================================================================ */

async function optimizeImage(file) {
  const extension = getFileExtension(file.name);
  const convertibleTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const convertibleExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
  const canAttemptConversion = convertibleTypes.has(file.type) || convertibleExtensions.has(extension);

  if (!canAttemptConversion) {
    return {
      blob: file,
      extension: extension || extensionFromMime(file.type) || "jpg",
      contentType: normalizeImageContentType(file.type, extension),
      optimized: false
    };
  }

  await yieldToMainThread();

  let decoded = null;
  try {
    decoded = await decodeImage(file);
    const sourceWidth = decoded.width;
    const sourceHeight = decoded.height;

    if (!sourceWidth || !sourceHeight) {
      throw createAppError("image/invalid-dimensions", "No se pudieron leer las dimensiones de la fotografía.");
    }

    const scale = Math.min(1, TARGET_LONG_SIDE / Math.max(sourceWidth, sourceHeight));
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d", { alpha: true, willReadFrequently: false });
    if (!context) {
      throw createAppError("image/canvas-unavailable", "El teléfono no permitió preparar esta fotografía.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, targetWidth, targetHeight);

    await yieldToMainThread();

    let outputBlob = await canvasToBlob(canvas, "image/webp", OUTPUT_QUALITY);
    if (!outputBlob || !outputBlob.type.startsWith("image/")) {
      outputBlob = await canvasToBlob(canvas, "image/jpeg", OUTPUT_QUALITY);
    }

    canvas.width = 1;
    canvas.height = 1;

    if (!outputBlob) {
      throw createAppError("image/compression-failed", "No se pudo comprimir la fotografía.");
    }

    const shouldUseOriginal = outputBlob.size >= file.size;
    const finalBlob = shouldUseOriginal ? file : outputBlob;
    const finalType = shouldUseOriginal
      ? normalizeImageContentType(file.type, extension)
      : outputBlob.type;
    const finalExtension = shouldUseOriginal
      ? (extension || extensionFromMime(finalType) || "jpg")
      : (extensionFromMime(finalType) || "jpg");

    return {
      blob: finalBlob,
      extension: finalExtension,
      contentType: finalType,
      optimized: !shouldUseOriginal
    };
  } catch (error) {
    console.warn(`No se pudo optimizar ${file.name}; se intentará subir el original.`, error);
    return {
      blob: file,
      extension: extension || extensionFromMime(file.type) || "jpg",
      contentType: normalizeImageContentType(file.type, extension),
      optimized: false
    };
  } finally {
    decoded?.cleanup?.();
    await yieldToMainThread();
  }
}

async function decodeImage(file) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close()
      };
    } catch (error) {
      console.warn("createImageBitmap no pudo decodificar la imagen; usando alternativa.", error);
    }
  }

  return loadImageElement(file);
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        cleanup: () => URL.revokeObjectURL(objectUrl)
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(createAppError("image/decode-failed", "El navegador no pudo convertir este formato."));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/* ================================================================
   CONEXIÓN, MÓVIL Y PWA
   ================================================================ */

function handleOnline() {
  state.isOnline = true;
  updateConnectionState();
  showToast("Conexión restablecida.", "success");

  if (!state.authReady) {
    window.setTimeout(() => initializeFirebase(), FIREBASE_RETRY_DELAY_MS);
  }
}

function handleOffline() {
  state.isOnline = false;
  updateConnectionState();
  showToast("Se perdió la conexión. Conservaremos tu selección en esta pantalla.", "warning", 6000);
}

function updateConnectionState() {
  state.isOnline = navigator.onLine;
  dom.offlineBanner.hidden = state.isOnline;

  if (!state.isOnline && !state.isUploading) {
    dom.bottomState.textContent = "Esperando conexión";
  }

  updateActionState();
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible" && navigator.onLine && !state.authReady) {
    initializeFirebase();
  }
}

function handleBeforeUnload(event) {
  if (!state.isUploading && !hasUnregisteredCompletedPhotos()) {
    return;
  }

  event.preventDefault();
  event.returnValue = "Hay un envío que todavía no ha terminado.";
}

function configureMobileViewport() {
  const updateViewportHeight = () => {
    const height = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty("--viewport-height", `${Math.round(height)}px`);
  };

  updateViewportHeight();
  window.addEventListener("resize", updateViewportHeight, { passive: true });
  window.addEventListener("orientationchange", () => window.setTimeout(updateViewportHeight, 120), { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateViewportHeight, { passive: true });
    window.visualViewport.addEventListener("scroll", updateViewportHeight, { passive: true });
  }
}

function configureZoomProtection() {
  const preventGesture = (event) => event.preventDefault();
  document.addEventListener("gesturestart", preventGesture, { passive: false });
  document.addEventListener("gesturechange", preventGesture, { passive: false });
  document.addEventListener("gestureend", preventGesture, { passive: false });

  document.addEventListener("touchmove", (event) => {
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  }, { passive: false });

  document.addEventListener("touchend", (event) => {
    const target = event.target;
    const isFormControl = target instanceof Element && Boolean(target.closest("input, textarea, select"));
    const now = Date.now();

    const isSameTarget = target === state.lastTouchTarget;
    if (!isFormControl && isSameTarget && now - state.lastTouchEnd <= 300) {
      event.preventDefault();
    }

    state.lastTouchEnd = now;
    state.lastTouchTarget = target;
  }, { passive: false });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    await registration.update();
  } catch (error) {
    console.warn("El service worker no pudo registrarse.", error);
  }
}

/* ================================================================
   MENSAJES Y ERRORES
   ================================================================ */

function showToast(message, type = "neutral", duration = TOAST_DURATION_MS) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  if (["success", "warning", "error"].includes(type)) {
    toast.classList.add(`is-${type}`);
  }

  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = type === "success" ? "✓" : type === "warning" ? "!" : type === "error" ? "×" : "•";

  const text = document.createElement("span");
  text.textContent = message;

  toast.append(icon, text);
  dom.toastRegion.append(toast);

  window.setTimeout(() => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 230);
  }, duration);
}

function showErrorDialog(title, message) {
  dom.errorDialogTitle.textContent = title;
  dom.errorDialogMessage.textContent = message;
  dom.errorDialog.hidden = false;
  window.setTimeout(() => dom.errorDialogButton.focus({ preventScroll: true }), 20);
}

function hideErrorDialog() {
  dom.errorDialog.hidden = true;
}

function getFriendlyErrorMessage(error, context = "general") {
  const code = String(error?.code || "");

  const messages = {
    "app/config-incomplete": "Falta completar la configuración pública de Firebase.",
    "auth/operation-not-allowed": "La autenticación anónima no está habilitada en Firebase.",
    "auth/network-request-failed": "No se pudo conectar con Firebase. Revisa tu conexión móvil.",
    "auth/too-many-requests": "Se realizaron demasiados intentos. Espera un momento e inténtalo nuevamente.",
    "auth/internal-error": "Firebase no pudo iniciar la sesión segura.",
    "storage/unauthorized": "Firebase rechazó el permiso. Revisa Authentication y las reglas de Storage.",
    "storage/unauthenticated": "La sesión segura terminó. Vuelve a cargar la aplicación.",
    "storage/retry-limit-exceeded": "La conexión estuvo inestable demasiado tiempo. Reintenta la fotografía.",
    "storage/quota-exceeded": "El almacenamiento de Firebase alcanzó su límite disponible.",
    "storage/invalid-checksum": "La fotografía llegó incompleta. Intenta subirla nuevamente.",
    "storage/canceled": "La carga fue cancelada.",
    "storage/unknown": "Firebase Storage no pudo guardar esta fotografía.",
    "permission-denied": "Firebase rechazó el registro. Revisa las reglas de Firestore.",
    "firestore/permission-denied": "Firebase rechazó el registro. Revisa las reglas de Firestore.",
    "unavailable": "El servicio no está disponible por el momento. Revisa tu conexión.",
    "firestore/unavailable": "Firestore no está disponible por el momento. Reintenta la confirmación.",
    "file/too-large-after-processing": `Una fotografía supera el límite de ${EVENT_CONFIG.maxPesoPorFotoMB} MB.`,
    "image/decode-failed": "El teléfono no pudo convertir este formato; se intentó enviar el original."
  };

  if (messages[code]) {
    return messages[code];
  }

  if (!navigator.onLine) {
    return "No hay conexión a internet. Conserva esta pantalla abierta y reintenta cuando vuelva la señal.";
  }

  if (context === "firestore") {
    return "Las fotografías ya subieron, pero no pudimos registrar la confirmación. Usa el botón para completar únicamente ese paso.";
  }

  if (context === "init") {
    return "No pudimos iniciar la conexión segura. Revisa Firebase y tu conexión a internet.";
  }

  if (context === "upload") {
    return "No pudimos completar esta fotografía. Puedes reintentar solamente las que fallaron.";
  }

  return "Ocurrió un problema inesperado. Inténtalo nuevamente.";
}

/* ================================================================
   UTILIDADES
   ================================================================ */

function sanitizeEventId(value) {
  const sanitized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 80);

  if (!sanitized) {
    throw new Error("EVENT_CONFIG.eventoId debe contener letras o números.");
  }

  return sanitized;
}

function createGuestFolderName(guestName, userId) {
  const safeName = sanitizeGuestName(guestName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "Invitado";

  const uidSuffix = String(userId ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8);

  if (!uidSuffix) {
    throw createAppError("auth/invalid-user", "No se pudo identificar la sesión del invitado.");
  }

  return `${safeName}-${uidSuffix}`;
}

function createDuplicateKey(file) {
  return `${file.name.toLowerCase()}|${file.size}|${file.lastModified}`;
}

function createUniqueFileName(originalName, outputExtension) {
  const baseName = originalName
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 42) || "foto";

  const timestamp = Date.now();
  const randomPart = createUniqueId().replace(/-/g, "").slice(0, 12);
  const extension = String(outputExtension || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";

  return `${timestamp}-${randomPart}-${baseName}.${extension}`;
}

function createUniqueId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  const random = window.crypto?.getRandomValues
    ? window.crypto.getRandomValues(new Uint32Array(4))
    : [Math.random() * 0xffffffff, Math.random() * 0xffffffff, Date.now(), performance.now()];

  return Array.from(random, (value) => Math.floor(Number(value)).toString(16).padStart(8, "0")).join("-");
}

function getFileExtension(fileName) {
  const match = String(fileName ?? "").toLowerCase().match(/\.([a-z0-9]+)$/i);
  return match ? match[1] : "";
}

function extensionFromMime(mimeType) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
    "image/bmp": "bmp",
    "image/tiff": "tiff"
  };
  return map[String(mimeType ?? "").toLowerCase()] || "";
}

function normalizeImageContentType(mimeType, extension) {
  if (typeof mimeType === "string" && mimeType.startsWith("image/")) {
    return mimeType;
  }

  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    avif: "image/avif",
    bmp: "image/bmp",
    tif: "image/tiff",
    tiff: "image/tiff"
  };

  return map[String(extension ?? "").toLowerCase()] || "image/jpeg";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** exponent);
  const decimals = exponent >= 2 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
}

function megabytesToBytes(megabytes) {
  return megabytes * 1024 * 1024;
}

function releasePhotoResources(photo) {
  if (photo.previewUrl) {
    URL.revokeObjectURL(photo.previewUrl);
    photo.previewUrl = "";
  }
  photo.processedBlob = null;
  photo.uploadMetadata = null;
}

function handleCoverLoaded() {
  dom.eventCover.classList.add("is-loaded");
  dom.coverSkeleton.hidden = true;
}

function handleCoverError() {
  dom.eventCover.hidden = true;
  dom.coverSkeleton.hidden = false;
  dom.coverSkeleton.style.animation = "none";
  showToast("No se encontró la portada. Reemplaza assets/portada-evento.jpg.", "warning", 6000);
}

function vibrate(pattern) {
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // La vibración es opcional.
    }
  }
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function yieldToMainThread() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function truncateText(value, maxLength) {
  const text = String(value ?? "");
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

function createAppError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(value);
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
