// Portfolio Website JavaScript

// View More/Less Projects Functionality
function showMore() {
    const additionalProjects = document.getElementById('additionalProjects');
    const viewMoreContainer = document.querySelector('.view-more-container');
    
    if (additionalProjects) {
        additionalProjects.style.display = 'block';
        console.log('Showing more projects');
        
        // Hide the view more button
        if (viewMoreContainer) {
            viewMoreContainer.style.display = 'none';
        }
    }
}
function showLess() {
    const additionalProjects = document.getElementById('additionalProjects');
    const viewMoreContainer = document.querySelector('.view-more-container');
    
    if (additionalProjects) {
        additionalProjects.style.display = 'none';
        console.log('Hiding projects');
        
        // Show the view more button again
        if (viewMoreContainer) {
            viewMoreContainer.style.display = 'flex';
        }
    }
}

// Make functions globally accessible
window.showMore = showMore;
window.showLess = showLess;

// Fade in animation for sections
const observerOptions = {
    threshold: 0.1,
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

// Observe all sections
document.addEventListener('DOMContentLoaded', () => {
    const sections = document.querySelectorAll('section, .projects-grid, .tech-grid, .education-grid, .contact-links');
    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });
    
    console.log('DOM loaded, functions ready');
});

// Scroll progress bar
window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset;
    const docHeight = document.body.offsetHeight - window.innerHeight;
    const scrollPercent = (scrollTop / docHeight) * 100;
    
    const progressBar = document.querySelector('.scroll-progress');
    if (progressBar) {
        progressBar.style.width = scrollPercent + '%';
    }
});

// Add hover effects for project cards
const projectCards = document.querySelectorAll('.project-card');
projectCards.forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-8px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) scale(1)';
    });
});

// Add click functionality for tech stack items
const techItems = document.querySelectorAll('.tech-item');
techItems.forEach(item => {
    item.addEventListener('click', function() {
        // Add a subtle click effect
        this.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.style.transform = 'scale(1)';
        }, 150);
    });
});

// Smooth scroll for navigation (if you add navigation later)
function smoothScrollTo(target) {
    const targetElement = document.querySelector(target);
    if (targetElement) {
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Add parallax effect for profile section
window.addEventListener('scroll', function() {
    const scrolled = window.pageYOffset;
    const profileSection = document.querySelector('.profile-section');
    
    if (profileSection) {
        const rate = scrolled * -0.5;
        profileSection.style.transform = `translateY(${rate}px)`;
    }
});

// Add loading animation
window.addEventListener('load', function() {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
});

// Add keyboard navigation support
document.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
        // Add focus indicators for keyboard navigation
        document.body.classList.add('keyboard-navigation');
    }
});

document.addEventListener('mousedown', function() {
    // Remove keyboard navigation indicators when using mouse
    document.body.classList.remove('keyboard-navigation');
});

// Add contact form functionality (if you want to add one later)
function setupContactForm() {
    const contactForm = document.querySelector('#contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(this);
            const name = formData.get('name');
            const email = formData.get('email');
            const message = formData.get('message');
            
            // Simple validation
            if (!name || !email || !message) {
                alert('Please fill in all fields');
                return;
            }
            
            // Here you would typically send the data to a server
            console.log('Form submitted:', { name, email, message });
            alert('Thank you for your message! I\'ll get back to you soon.');
            
            // Reset form
            this.reset();
        });
    }
}

// Initialize contact form if it exists
setupContactForm();

// Add dark mode toggle (optional feature)
function setupDarkMode() {
    const darkModeToggle = document.querySelector('#dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark-mode');
            
            // Save preference to localStorage
            const isDarkMode = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDarkMode);
        });
        
        // Check for saved preference
        const savedDarkMode = localStorage.getItem('darkMode');
        if (savedDarkMode === 'true') {
            document.body.classList.add('dark-mode');
        }
    }
}

// Initialize dark mode if toggle exists
setupDarkMode();

// Add scroll progress indicator
function setupScrollProgress() {
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 0%;
        height: 3px;
        background: #ff0000;
        z-index: 1000;
        transition: width 0.1s ease;
    `;
    
    document.body.appendChild(progressBar);
    
    window.addEventListener('scroll', function() {
        const scrolled = (window.pageYOffset / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
        progressBar.style.width = scrolled + '%';
    });
}

// Initialize scroll progress
setupScrollProgress();

// Glass Button Displacement Map and circular favicon
document.addEventListener('DOMContentLoaded', () => {
    const feImage = document.querySelector('feImage');
    if (feImage) {
        fetch('https://essykings.github.io/JavaScript/map.png')
            .then((response) => response.blob())
            .then((blob) => {
                const objURL = URL.createObjectURL(blob);
                feImage.setAttribute('href', objURL);
            })
            .catch((error) => {
                console.log('Could not load displacement map:', error);
            });
    }

    // Build a circular PNG favicon from the profile photo at runtime
    function setCircularFavicon(src) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const size = 64;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, size, size);
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, 0, 0, size, size);
            const url = canvas.toDataURL('image/png');
            let link = document.querySelector('link[rel="icon"]');
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.type = 'image/png';
            link.href = url;
            let shortcut = document.querySelector('link[rel="shortcut icon"]');
            if (shortcut) {
                shortcut.type = 'image/png';
                shortcut.href = url;
            }
        };
        // cache-bust the source
        img.src = src + (src.includes('?') ? '&' : '?') + 'cb=' + Date.now();
    }

    setCircularFavicon('assets/profile.jpg');

    // Glass Button Scroll to Top Functionality
    const glassButton = document.querySelector('.glass-button');
    if (glassButton) {
        glassButton.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
});

// View More Projects functionality
const viewMoreBtn = document.getElementById('viewMoreBtn');
const additionalProjects = document.getElementById('additionalProjects');
const showLessBtn = document.getElementById('showLessBtn');

if (viewMoreBtn && additionalProjects && showLessBtn) {
    viewMoreBtn.addEventListener('click', function() {
        additionalProjects.style.display = 'grid';
        viewMoreBtn.style.display = 'none';
    });
    
    showLessBtn.addEventListener('click', function() {
        additionalProjects.style.display = 'none';
        viewMoreBtn.style.display = 'block';
    });
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export functions for potential external use
window.portfolioUtils = {
    smoothScrollTo: function(target) {
        const targetElement = document.querySelector(target);
        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    },
    
    typeWriter: function(element, text, speed = 100) {
        let i = 0;
        element.innerHTML = '';
        
        function type() {
            if (i < text.length) {
                element.innerHTML += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        type();
    }
};
