importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBtIGiFFIdIVlPqEOUivEbgpJvg0nGyNWs",
    projectId: "mojamyapps",
    messagingSenderId: "681534222590",
    appId: "1:681534222590:web:a18243c1c136195ef875af"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
    const notificationTitle = payload.data.title || payload.notification.title || "Pesan Baru";
    const notificationOptions = {
        body: payload.data.body || payload.notification.body || "",
        icon: './1789744567730.png'
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});
