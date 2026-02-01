document.addEventListener('DOMContentLoaded', function() {
    initScrollAnimations();
    initProjectCards();
    initSmoothScrolling();
    initParallaxEffect();
    initVideoBackground();
});

function initScrollAnimations() {
    // Lower threshold on mobile for better trigger points
    const isMobile = window.innerWidth < 768;
    const observerOptions = {
        threshold: isMobile ? 0.05 : 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.project-card, .social-link');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

function initProjectCards() {
    const cards = document.querySelectorAll('.project-card');
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    cards.forEach(card => {
        // Only add hover effects on non-touch devices
        if (!isTouchDevice) {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-8px) scale(1.02)';
            });

            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0) scale(1)';
            });
        }

        // Ripple effect works on all devices
        card.addEventListener('click', function(e) {
            const ripple = document.createElement('div');
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.6);
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
            `;

            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';

            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });
}

function initSmoothScrolling() {
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', function() {
            document.querySelector('.portfolio-grid').scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });
    }
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

function initParallaxEffect() {
    let ticking = false;
    
    function updateParallax() {
        const scrolled = window.pageYOffset;
        const heroVideo = document.querySelector('.hero-video');
        
        if (heroVideo) {
            const rate = scrolled * -0.3;
            heroVideo.style.transform = `translateX(-50%) translateY(calc(-50% + ${rate}px))`;
        }
        
        ticking = false;
    }
    
    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateParallax);
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', requestTick);
}

function initVideoBackground() {
    const video = document.querySelector('.hero-video');
    
    if (video) {
        video.addEventListener('loadedmetadata', function() {
            console.log('Video loaded successfully');
        });
        
        video.addEventListener('error', function(e) {
            console.error('Video failed to load:', e);
            video.style.display = 'none';
        });
        
        // Ensure video plays on mobile devices
        video.addEventListener('canplaythrough', function() {
            video.play().catch(function(error) {
                console.log('Autoplay prevented:', error);
            });
        });
        
        // Pause video when not in viewport for performance
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    video.play().catch(e => console.log('Play failed:', e));
                } else {
                    video.pause();
                }
            });
        }, { threshold: 0.1 });
        
        observer.observe(video);
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Debounced resize handler for responsive adjustments
let resizeTimer;
let previousWidth = window.innerWidth;

window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        const currentWidth = window.innerWidth;
        const crossedBreakpoint =
            (previousWidth < 1024 && currentWidth >= 1024) ||
            (previousWidth >= 1024 && currentWidth < 1024);

        if (crossedBreakpoint) {
            // Reinitialize animations when crossing desktop breakpoint
            initScrollAnimations();
        }

        previousWidth = currentWidth;
    }, 250);
});

function runSpeechRecognition() {
    const output = document.getElementById("output");
    const action = document.getElementById("action");
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        action.innerHTML = "<small>Speech recognition not supported in this browser</small>";
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onstart = function() {
        action.innerHTML = "<small>Listening... please speak</small>";
        action.style.color = '#667eea';
    };
    
    recognition.onend = function() {
        action.innerHTML = "<small>Stopped listening</small>";
        action.style.color = '#4a5568';
    };
    
    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript.toLowerCase();
        const confidence = event.results[0][0].confidence;
        
        let response;
        if (transcript.includes("hello") || transcript.includes("hi")) {
            response = `Hello! You said: "${transcript}"`;
        } else {
            response = `You said: "${transcript}" - Try saying "hello"!`;
        }
        
        output.innerHTML = response;
        output.classList.remove("hide");
        output.style.opacity = '1';
        output.style.transform = 'translateY(0)';
    };
    
    recognition.onerror = function(event) {
        action.innerHTML = `<small>Error: ${event.error}</small>`;
        action.style.color = '#e53e3e';
    };
    
    recognition.start();
}
