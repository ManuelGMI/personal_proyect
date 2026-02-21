const firebaseConfig = {
    apiKey: "AIzaSyBj3UzdXDxZecMlymyLheu9k3Wv5yAcvMg",
    authDomain: "license-manager-4fe52.firebaseapp.com",
    projectId: "license-manager-4fe52",
    storageBucket: "license-manager-4fe52.firebasestorage.app",
    messagingSenderId: "1037932783488",
    appId: "1:1037932783488:web:e7d0e94e1b9cbdb241c365"
};

// Se inicializa Firebase usando la version "compat" que funciona sin servidor local
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
window.lh_auth = firebase.auth();
