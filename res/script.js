const currentYear = () => new Date().getFullYear();

const insertCurrentYear = () => document
    .querySelectorAll('.current-year')
    .forEach(node => node.textContent = currentYear());

document.addEventListener("DOMContentLoaded", () => insertCurrentYear());