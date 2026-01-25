const MAIN_BRANCH = 'life';
const BRANCH_COLORS = {
    'life': '#006699',
    'work': '#3385ad',
    'academic': '#66a3c2',
};
const FALLBACK_COLOR = '#999';

const defineBranchColorsAsCssVariables = () => {
    const documentRoot = document.documentElement;

    Object.entries(BRANCH_COLORS)
        .forEach(([name, column]) =>
            documentRoot.style.setProperty(`--branch-${name}`, column)
        );
};

const GRAPH_CONTAINER_LEFT_PADDING = 2;
const config = () => {
    return window.innerWidth <= 720 ? {
        VERTICAL_Y_COMMIT_SPACING: 80,
        HORIZONTAL_LANE_GAP: 30,
    } : {
        VERTICAL_Y_COMMIT_SPACING: 70,
        HORIZONTAL_LANE_GAP: 50,
    };
};

const parseParentsRawToArray = parentsRaw => parentsRaw
    .split(',')
    .map(element => element.trim())
    .filter(Boolean);

const getCommitsParents = parentsRaw => parentsRaw ? parseParentsRawToArray(parentsRaw) : [];

const getCommitOrder = element => {
    const styleContent = element.style.getPropertyValue('--order');
    if (styleContent) return Number(styleContent);
    return 0;
};

const mapCommitElement = element => {
    const id = element.dataset.id;
    const branch = element.dataset.branch || 'main';

    const parentsRaw = (element.dataset.parents || '').trim();
    const parents = getCommitsParents(parentsRaw);

    const order = getCommitOrder(element);

    return {element, id, branch, parents, order};
};

const readInCommitNodes = container =>
    Array.from(container.querySelectorAll('.commit'))
        .map(commitElement => mapCommitElement(commitElement))
        .sort((a, b) => (a.order - b.order));

const getLinkColor = (childNode, parentNode) => {
    if (!parentNode) return FALLBACK_COLOR;
    if (parentNode.branch !== MAIN_BRANCH) {
        return BRANCH_COLORS[parentNode.branch];
    } else if (childNode.branch !== MAIN_BRANCH) {
        return BRANCH_COLORS[childNode.branch];
    }
    return BRANCH_COLORS[MAIN_BRANCH];
};

const calculateKinkedPath = (fromNode, fromPosition, toNode, toPosition) => {
    if (fromNode.branch === toNode.branch) {
        return `M ${fromPosition.x} ${fromPosition.y} L ${toPosition.x} ${toPosition.y}`;
    }

    const dy = toPosition.y - fromPosition.y;

    const intensity = 0.2;
    const kinkOffset = Math.abs(dy) * intensity;

    const middleOfX = (fromPosition.x + toPosition.x) / 2 + kinkOffset;
    const middleOfY = (fromPosition.y + toPosition.y) / 2;

    return `M ${fromPosition.x} ${fromPosition.y} L ${middleOfX} ${middleOfY} L ${toPosition.x} ${toPosition.y}`;
};

const getCommitConnectionLine = (fromNode, fromPosition, toNode, toPosition, color) => ({
    'd': calculateKinkedPath(fromNode, fromPosition, toNode, toPosition,),
    'stroke': color,
    'stroke-width': '3',
    'fill': 'none',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'opacity': '0.95'
});

const drawLinkAsPath = (fromNode, fromPosition, toNode, toPosition, color) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    Object.entries(getCommitConnectionLine(fromNode, fromPosition, toNode, toPosition, color))
        .forEach(([key, val]) => path.setAttribute(key, val));

    return path;
};

const drawLinkToChildNodes = (commitNodes, childNode, idPosition, canvas, childPosition) => parentId => {
    const parentNode = commitNodes.find(node => node.id === parentId);
    const color = getLinkColor(childNode, parentNode);

    const parentPosition = idPosition.get(parentId);
    if (!parentPosition) return;

    canvas.appendChild(drawLinkAsPath(childNode, childPosition, parentNode, parentPosition, color));
};

const drawNode = (idPosition, childNode, commitNodes, canvas) => {
    const childPosition = idPosition.get(childNode.id);
    if (!childPosition || childNode.parents.length === 0) return;

    childNode.parents
        .forEach(drawLinkToChildNodes(commitNodes, childNode, idPosition, canvas, childPosition));
};

const drawNodes = (commitNodes, idPosition, canvas) => commitNodes.forEach(childNode => drawNode(idPosition, childNode, commitNodes, canvas));

const ensureCommitsOnTop = commitNodes => commitNodes.forEach(commitNode => commitNode.element.style.zIndex = 2);

const generateCommitCoordinates = (branchIndex, commitNode, commitNodes, idx) => {
    const lane = branchIndex.get(commitNode.branch);
    const x = GRAPH_CONTAINER_LEFT_PADDING + lane * config().HORIZONTAL_LANE_GAP;
    const y = config().VERTICAL_Y_COMMIT_SPACING / 2 + (commitNodes.length - 1 - idx) * config().VERTICAL_Y_COMMIT_SPACING;
    return {x, y};
};

const updateCommitElement = (commitNode, {x, y}) => {
    const dot = commitNode.element.querySelector('.commit-dot');
    const message = commitNode.element.querySelector('.commit-message');

    const commitMeta = message.querySelector('.commit-meta');

    const backgroundColor = BRANCH_COLORS[commitNode.branch] || FALLBACK_COLOR;

    if (dot) {
        if (!dot.style.background) dot.style.background = backgroundColor;
        dot.style.left = `${x - 9}px`;
        dot.style.top = `${y - 9}px`;
    }

    if (message) {
        message.style.top = `${y - 9}px`;

        if (commitMeta) {
            commitMeta.style.background = backgroundColor;
            commitMeta.style.color = backgroundColor;
        }
    }
};

const calculateNodePositions = (commitNodes, branchIndex) =>
    new Map(commitNodes.map((commitNode, idx) => {
        const coords = generateCommitCoordinates(branchIndex, commitNode, commitNodes, idx);
        return [commitNode.id, coords];
    }));

const generateBranchIndex = commitNodes =>
    commitNodes
        .reduce((m, c) => {
            if (!m.has(c.branch)) m.set(c.branch, m.size);
            return m;
        }, new Map());


const renderCommitNodes = (container, canvas) => {
    const commitNodes = readInCommitNodes(container);

    const branchIndex = generateBranchIndex(commitNodes);
    const idPosition = calculateNodePositions(commitNodes, branchIndex);

    const height = Math.max(240, (commitNodes.length) * config().VERTICAL_Y_COMMIT_SPACING);

    container.style.minHeight = height + 'px';
    canvas.setAttribute('width', container.clientWidth);
    canvas.setAttribute('height', container.clientHeight);

    commitNodes.forEach(node => {
        const coords = idPosition.get(node.id);
        if (coords) updateCommitElement(node, coords);
    });

    drawNodes(commitNodes, idPosition, canvas);

    ensureCommitsOnTop(commitNodes);
};

const getContainerAndCanvas = () => {
    const container = document.getElementById('graph-container');
    const canvas = document.getElementById('graph-canvas');
    return {container, canvas};
};

const renderGitGraph = (() => {
    const {container, canvas} = getContainerAndCanvas();

    defineBranchColorsAsCssVariables();

    renderCommitNodes(container, canvas);
});

const debounce = (fn, delay) => {
    let timeoutId;

    return (...args) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn(...args);
        }, delay);
    };
};

const rerenderGraph = () => {
    const {container, canvas} = getContainerAndCanvas();

    canvas.innerHTML = '';

    renderCommitNodes(container, canvas);
};

const handledResize = debounce(rerenderGraph, 25);
window.addEventListener('resize', handledResize);

document.addEventListener("DOMContentLoaded", () => renderGitGraph());