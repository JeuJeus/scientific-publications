const currentYear = () => new Date().getFullYear();

const insertCurrentYear = () => document
    .querySelectorAll('.current-year')
    .forEach(node => node.textContent = currentYear());

const initNavigationToggle = () => {
    const navToggle = document.getElementById('nav-toggle');
    const mainNav = document.getElementById('main-nav');

    if (!navToggle || !mainNav) return;

    const toggleNav = () => {
        const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
        navToggle.setAttribute('aria-expanded', !isExpanded);

        if (isExpanded) {
            mainNav.classList.remove('nav-expanded');
            mainNav.classList.add('nav-collapsed');
        } else {
            mainNav.classList.remove('nav-collapsed');
            mainNav.classList.add('nav-expanded');
        }
    };

    navToggle.addEventListener('click', toggleNav);

    mainNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 720) {
                navToggle.setAttribute('aria-expanded', 'false');
                mainNav.classList.remove('nav-expanded');
                mainNav.classList.add('nav-collapsed');
            }
        });
    });
};

document.addEventListener("DOMContentLoaded", () => {
    insertCurrentYear();
    initNavigationToggle();
});

