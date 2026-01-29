const MAIN_BRANCH = 'life';
const BRANCH_ORDER = ['life', 'academic', 'work'];
const BRANCH_COLORS = {
    'life': '#006699',
    'work': '#3385ad',
    'academic': '#66a3c2',
};

const FALLBACK_COLOR = '#999';

const EXPAND_BUTTON_ID = 'git-graph-expand-btn';

let isGraphExpanded = false;

const defineBranchColorsAsCssVariables = () => {
    const documentRoot = document.documentElement;
    Object.entries(BRANCH_COLORS).forEach(([name, column]) =>
        documentRoot.style.setProperty(`--branch-${name}`, column)
    );
};

const GRAPH_CONTAINER_LEFT_PADDING = 2;
const BUTTON_HEIGHT_SPACE = 60;

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

const shouldBeVisibleByCollapseAndHideState = commit => !isGraphExpanded && commit.dataset.defaultCollapsed === 'true';

const readInCommitNodes = container => {
    const allElements = Array.from(container.querySelectorAll('.commit'));

    allElements.forEach(commit => commit.style.display = shouldBeVisibleByCollapseAndHideState(commit) ? 'none' : '');

    return allElements
        .filter(el => isGraphExpanded || el.dataset.defaultCollapsed !== 'true')
        .map(mapCommitElement)
        .sort((a, b) => (a.order - b.order));
};

const getLinkColor = (child, parent) => {
    const getBranchColor = (branch) => BRANCH_COLORS[branch] || FALLBACK_COLOR;
    const candidates = [parent?.branch, child?.branch, MAIN_BRANCH];
    const activeBranch = candidates.find(b => b && b !== MAIN_BRANCH) || MAIN_BRANCH;
    return getBranchColor(activeBranch);
};

const calculateKinkedPath = (fromNode, fromPosition, toNode, toPosition) => {
    if (fromNode.branch === toNode.branch) {
        return `M ${fromPosition.x} ${fromPosition.y} L ${toPosition.x} ${toPosition.y}`;
    }

    const intensity = 0.2;
    const kinkOffset = Math.abs(toPosition.y - fromPosition.y) * intensity;
    const middleOfX = (fromPosition.x + toPosition.x) / 2 + kinkOffset;
    const middleOfY = (fromPosition.y + toPosition.y) / 2;

    return `M ${fromPosition.x} ${fromPosition.y} L ${middleOfX} ${middleOfY} L ${toPosition.x} ${toPosition.y}`;
};

const drawLinkAsPath = (childNode, childPos, parentNode, parentPos) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', calculateKinkedPath(childNode, childPos, parentNode, parentPos));
    path.setAttribute('stroke', getLinkColor(childNode, parentNode));
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('opacity', '0.95');
    return path;
};

const drawNode = (idPosition, childNode, commitNodes, canvas) => {
    const childPos = idPosition.get(childNode.id);
    if (!childPos) return;

    childNode.parents.forEach(parentId => {
        const parentNode = commitNodes.find(n => n.id === parentId);
        const parentPos = idPosition.get(parentId);
        if (parentNode && parentPos) {
            canvas.appendChild(drawLinkAsPath(childNode, childPos, parentNode, parentPos));
        }
    });
};

const drawNodes = (commitNodes, idPosition, canvas) => {
    commitNodes.forEach(childNode => drawNode(idPosition, childNode, commitNodes, canvas));
};

const updateCommitElement = (commitNode, {x, y}) => {
    const dot = commitNode.element.querySelector('.commit-dot');
    const message = commitNode.element.querySelector('.commit-message');
    const backgroundColor = BRANCH_COLORS[commitNode.branch] || FALLBACK_COLOR;

    if (dot) {
        dot.style.background = backgroundColor;
        dot.style.left = `${x - 9}px`;
        dot.style.top = `${y - 9}px`;
    }
    if (message) {
        message.style.top = `${y - 9}px`;
        const meta = message.querySelector('.commit-meta');
        if (meta) {
            meta.style.background = backgroundColor;
            meta.style.color = '#fff'; // Improved readability
        }
    }
};

const generateBranchIndex = () => new Map(BRANCH_ORDER.map((name, i) => [name, i]));

const onGraphExtendButtonClick = () => () => {
    isGraphExpanded = !isGraphExpanded;
    rerenderGraph();
};

const updateExpandButton = (container) => {
    let expandButton = document.getElementById(EXPAND_BUTTON_ID);
    if (!expandButton) {
        expandButton = document.createElement('div');
        expandButton.id = EXPAND_BUTTON_ID;
        expandButton.addEventListener('click', onGraphExtendButtonClick());
        container.appendChild(expandButton);
    }
    expandButton.innerHTML = isGraphExpanded ? '&#8593; Collapse History' : '&#8595; Show Earlier History (2017-2021)';
};

const getIdPositions = (commitNodes, branchIndex) =>
    new Map(commitNodes.map((node, idx) => {
        const lane = branchIndex.get(node.branch) ?? 0;
        const x = GRAPH_CONTAINER_LEFT_PADDING + lane * config().HORIZONTAL_LANE_GAP;
        const y = config().VERTICAL_Y_COMMIT_SPACING / 2 + (commitNodes.length - 1 - idx) * config().VERTICAL_Y_COMMIT_SPACING;
        return [node.id, {x, y}];
    }));

const renderCommitNodes = (container, canvas) => {
    const commitNodes = readInCommitNodes(container);
    const branchIndex = generateBranchIndex();
    const idPosition = getIdPositions(commitNodes, branchIndex);

    const totalHeight = Math.max(240, (commitNodes.length * config().VERTICAL_Y_COMMIT_SPACING) + BUTTON_HEIGHT_SPACE);
    container.style.minHeight = totalHeight + 'px';
    container.style.position = 'relative';

    canvas.setAttribute('width', container.clientWidth);
    canvas.setAttribute('height', container.clientHeight);

    commitNodes.forEach(node => {
        const coords = idPosition.get(node.id);
        if (coords) updateCommitElement(node, coords);
    });

    drawNodes(commitNodes, idPosition, canvas);
    updateExpandButton(container);
};

const getContainerAndCanvas = () => ({
    container: document.getElementById('graph-container'),
    canvas: document.getElementById('graph-canvas')
});

const renderGitGraph = () => {
    const {container, canvas} = getContainerAndCanvas();
    defineBranchColorsAsCssVariables();
    renderCommitNodes(container, canvas);
};

const rerenderGraph = () => {
    const {canvas} = getContainerAndCanvas();
    canvas.innerHTML = '';
    renderGitGraph();
};

window.addEventListener('resize', () => {
    const {canvas} = getContainerAndCanvas();
    canvas.innerHTML = '';
    renderGitGraph();
});

document.addEventListener("DOMContentLoaded", renderGitGraph);