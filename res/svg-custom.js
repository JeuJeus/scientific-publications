customElements.define("load-svg", class extends HTMLElement {
    async connectedCallback(
        src = this.getAttribute("src"),
        svgStyles = this.svgStyles || this.attachShadow({mode:"open"})
    ) {
        svgStyles.innerHTML = await (await fetch(src)).text()
        svgStyles.append(...this.querySelectorAll("[svgStyles]"))
        this.hasAttribute("replaceWith") && this.replaceWith(...svgStyles.childNodes)
    }
})