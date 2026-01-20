const insertCurrentYear = () => {
    const yearSpan = document.querySelectorAll('.current-year');
    yearSpan.forEach(node => node.textContent = new Date().getFullYear());
};

document.addEventListener("DOMContentLoaded", () => insertCurrentYear())