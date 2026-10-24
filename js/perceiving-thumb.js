document.addEventListener('DOMContentLoaded', function () {
    const video = document.getElementById('perceiving-thumb-video');
    const fallback = document.getElementById('perceiving-thumb-fallback');

    if (!video || !fallback) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(function (stream) {
            video.srcObject = stream;
            video.classList.remove('hide');
            fallback.classList.add('hide');

            window.addEventListener('pagehide', function () {
                stream.getTracks().forEach(function (track) { track.stop(); });
            });
        })
        .catch(function () {
            // Permission denied or no camera available: keep the black
            // background with the "Camera feed" fallback label showing.
        });
});
