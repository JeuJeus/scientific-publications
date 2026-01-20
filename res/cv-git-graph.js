const MAIN_BRANCH = 'life';
const BRANCH_COLORS = {
    'life': '#006699',     // Basis (Deep Ocean Blue)
    'work': '#3385ad',     // Medium (Steel Blue)
    'academic': '#66a3c2', // Light (Sky Blue)
};

const defineBranchColorsAsCssVariables = () => {
    const docRoot = document.documentElement;
    Object.entries(BRANCH_COLORS)
        .forEach(([name, col]) =>
            docRoot.style.setProperty(`--branch-${name}`, col)
        );
};

const SPACING_Y = 65; // vertical spacing between commits
const LANE_GAP = 30;  // horizontal gap between lanes
const LEFT_PADDING = 2; // left padding inside graph-container for lane start

const getCommitsParents = parentsRaw => parentsRaw ? parentsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

const getCommitOrder = el => {
    const s = el.style.getPropertyValue('--order');
    if (s) return Number(s);
    return 0;
};

const mapCommitElement = el => {
    const id = el.dataset.id;
    const branch = el.dataset.branch || 'main';

    const parentsRaw = (el.dataset.parents || '').trim();
    const parents = getCommitsParents(parentsRaw);

    const order = getCommitOrder(el);

    return {el, id, branch, parents, order};
};

const readInCommitNodes = container =>
    Array.from(container.querySelectorAll('.commit'))
        .map(commitElement => mapCommitElement(commitElement))
        .sort((a, b) => (a.order - b.order));

const getLinkColor = (childNode, parentNode) => {
    if (!parentNode) return '#999';
    if (parentNode.branch !== MAIN_BRANCH) {
        return BRANCH_COLORS[parentNode.branch];
    } else if (childNode.branch !== MAIN_BRANCH) {
        return BRANCH_COLORS[childNode.branch];
    } else {
        return BRANCH_COLORS[MAIN_BRANCH];
    }
};

const calculateKinkedPath = (fromNode, fromPos, toNode, toPos) => {
    if (fromNode.branch === toNode.branch) {
        return `M ${fromPos.x} ${fromPos.y} L ${toPos.x} ${toPos.y}`;
    }

    const dy = toPos.y - fromPos.y;

    const intensity = 0.2;
    const kinkOffset = Math.abs(dy) * intensity;

    const midX = (fromPos.x + toPos.x) / 2 + kinkOffset;
    const midY = (fromPos.y + toPos.y) / 2;

    return `M ${fromPos.x} ${fromPos.y} L ${midX} ${midY} L ${toPos.x} ${toPos.y}`;
};

const drawLinkAsPath = (fromNode, fromPos, toNode, toPos, color = '#999') => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    const attrs = {
        'd': calculateKinkedPath(fromNode, fromPos, toNode, toPos,),
        'stroke': color,
        'stroke-width': '3',
        'fill': 'none',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'opacity': '0.95'
    };

    Object.entries(attrs).forEach(([key, val]) => path.setAttribute(key, val));

    return path;
};

const drawNodes = (commitNodes, idPos, svg) => {
    commitNodes.forEach(childNode => {
        const childPos = idPos.get(childNode.id);
        if (!childPos) return;
        if (childNode.parents.length === 0) return;
        childNode.parents.forEach(parentId => {
            let parentNode = commitNodes.find(node => node.id === parentId);
            let color = getLinkColor(childNode, parentNode);
            const parentPos = idPos.get(parentId);
            if (!parentPos) return;
            svg.appendChild(drawLinkAsPath(childNode, childPos, parentNode, parentPos, color));
        });
    });
};

const ensureCommitsOnTop = commitNodes => commitNodes.forEach(c => c.el.style.zIndex = 2);

const generateCommitCoordinates = (branchIndex, c, commitNodes, idx) => {
    const lane = branchIndex.get(c.branch);
    const x = LEFT_PADDING + lane * LANE_GAP;

    const y = SPACING_Y / 2 + (commitNodes.length - 1 - idx) * SPACING_Y;
    return {x, y};
};

const calculateNodePositions = (commitNodes, branchIndex) => {
    const idPos = new Map();
    commitNodes.forEach((c, idx) => {
        const {x, y} = generateCommitCoordinates(branchIndex, c, commitNodes, idx);

        const dot = c.el.querySelector('.commit-dot');
        if (dot && !dot.style.background) dot.style.background = BRANCH_COLORS[c.branch] || '#999';

        dot.style.left = (x - 9) + 'px   '; // adjust so dot center matches x (dot radius ~7)
        dot.style.top = (y - 9) + 'px';

        const message = c.el.querySelector('.commit-message');
        message.style.top = (y - 9) + 'px';

        idPos.set(c.id, {x, y});
    });
    return idPos;
};

const renderGitGraph = (() => {
    const root = document.getElementById('git-graph');
    if (!root) return;

    const container = document.getElementById('graph-container');
    const svg = document.getElementById('graph-canvas');

    defineBranchColorsAsCssVariables();

    const commitNodes = readInCommitNodes(container);

    const branchIndex = commitNodes
        .reduce((m, c) => {
            if (!m.has(c.branch)) m.set(c.branch, m.size);
            return m;
        }, new Map());

    const height = Math.max(240, (commitNodes.length) * SPACING_Y);
    container.style.minHeight = height + 'px';
    svg.setAttribute('width', container.clientWidth);
    svg.setAttribute('height', container.clientHeight);

    drawNodes(commitNodes, calculateNodePositions(commitNodes, branchIndex), svg);
    ensureCommitsOnTop(commitNodes);
});

document.addEventListener("DOMContentLoaded", () => renderGitGraph());