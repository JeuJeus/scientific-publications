const MAIN_BRANCH = 'life';
const BRANCH_COLORS = {
    'life': '#006699',
    'work': '#3385ad',
    'academic': '#66a3c2',
};

const defineBranchColorsAsCssVariables = () => {
    const documentRoot = document.documentElement;
    Object.entries(BRANCH_COLORS)
        .forEach(([name, column]) =>
            documentRoot.style.setProperty(`--branch-${name}`, column)
        );
};

const VERTICAL_Y_COMMIT_SPACING = 65;
const HORIZONTAL_LANGE_GAP = 30;
const GRAPH_CONTAINER_LEFT_PADDING = 2;

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
    if (!parentNode) return '#999';
    if (parentNode.branch !== MAIN_BRANCH) {
        return BRANCH_COLORS[parentNode.branch];
    } else if (childNode.branch !== MAIN_BRANCH) {
        return BRANCH_COLORS[childNode.branch];
    } else {
        return BRANCH_COLORS[MAIN_BRANCH];
    }
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

const drawLinkAsPath = (fromNode, fromPosition, toNode, toPosition, color = '#999') => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    Object.entries({
        'd': calculateKinkedPath(fromNode, fromPosition, toNode, toPosition,),
        'stroke': color,
        'stroke-width': '3',
        'fill': 'none',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'opacity': '0.95'
    })
        .forEach(([key, val]) => path.setAttribute(key, val));

    return path;
};

const drawLinkToChildNodes = (commitNodes, childNode, idPosition, svg, childPosition) => parentId => {
    const parentNode = commitNodes.find(node => node.id === parentId);
    const color = getLinkColor(childNode, parentNode);

    const parentPosition = idPosition.get(parentId);
    if (!parentPosition) return;

    svg.appendChild(drawLinkAsPath(childNode, childPosition, parentNode, parentPosition, color));
};

const drawNodes = (commitNodes, idPosition, svg) =>
    commitNodes.forEach(childNode => {

        const childPosition = idPosition.get(childNode.id);
        if (!childPosition || childNode.parents.length === 0) return;

        childNode.parents
            .forEach(drawLinkToChildNodes(commitNodes, childNode, idPosition, svg, childPosition));
    });

const ensureCommitsOnTop = commitNodes => commitNodes.forEach(commitNode => commitNode.element.style.zIndex = 2);

const generateCommitCoordinates = (branchIndex, commitNode, commitNodes, idx) => {
    const lane = branchIndex.get(commitNode.branch);
    const x = GRAPH_CONTAINER_LEFT_PADDING + lane * HORIZONTAL_LANGE_GAP;
    const y = VERTICAL_Y_COMMIT_SPACING / 2 + (commitNodes.length - 1 - idx) * VERTICAL_Y_COMMIT_SPACING;
    return {x, y};
};

const updateCommitElement = (commitNode, {x, y}) => {
    const dot = commitNode.element.querySelector('.commit-dot');
    const message = commitNode.element.querySelector('.commit-message');

    const commitMeta = message.querySelector('.commit-meta');

    const backgroundColor = BRANCH_COLORS[commitNode.branch] || '#999';

    if (dot) {
        if (!dot.style.background) dot.style.background = backgroundColor;
        dot.style.left = `${x - 9}px`;
        dot.style.top = `${y - 9}px`;
    }

    if (message) {
        message.style.top = `${y - 9}px`;

        if (commitMeta) {
            console.log(commitMeta)
            commitMeta.style.background = backgroundColor;
        }
    }
};

const calculateNodePositions = (commitNodes, branchIndex) =>
    new Map(
        commitNodes.map((commitNode, idx) => {
            const coords = generateCommitCoordinates(branchIndex, commitNode, commitNodes, idx);
            updateCommitElement(commitNode, coords);
            return [commitNode.id, coords];
        })
    );

const generateBranchIndex = commitNodes => commitNodes
    .reduce((m, c) => {
        if (!m.has(c.branch)) m.set(c.branch, m.size);
        return m;
    }, new Map());

const renderGitGraph = (() => {
    const root = document.getElementById('git-graph');
    if (!root) return;

    const container = document.getElementById('graph-container');
    const svg = document.getElementById('graph-canvas');

    defineBranchColorsAsCssVariables();

    const commitNodes = readInCommitNodes(container);

    const height = Math.max(240, (commitNodes.length) * VERTICAL_Y_COMMIT_SPACING);
    container.style.minHeight = height + 'px';
    svg.setAttribute('width', container.clientWidth);
    svg.setAttribute('height', container.clientHeight);

    drawNodes(commitNodes, calculateNodePositions(commitNodes, generateBranchIndex(commitNodes)), svg);
    ensureCommitsOnTop(commitNodes);
});

document.addEventListener("DOMContentLoaded", () => renderGitGraph());