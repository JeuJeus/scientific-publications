const BRANCHES = {
    'life': {
        color: {
            light: '#006699',
            dark: '#10b981'
        },
        mainBranch: true,
        branchOrder: 1
    },
    'academic': {
        color: {
            light: '#66a3c2',
            dark: '#34d399'
        },
        mainBranch: false,
        branchOrder: 2
    },
    'work': {
        color: {
            light: '#3385ad',
            dark: '#059669'
        },
        mainBranch: false,
        branchOrder: 3
    },
};

const FALLBACK_COLORS = {
    color: {
        light: '#999',
        dark: '#d0d0d0',
    }
};

const getMainBranch = () => Object.keys(BRANCHES).find(key => BRANCHES[key].mainBranch);

const getBranchOrder = () => Object.keys(BRANCHES)
    .sort((a, b) => BRANCHES[a].branchOrder - BRANCHES[b].branchOrder);

const getDarkModeMatchingColor = val => {
    const currentTheme = document.documentElement.getAttribute('data-theme');

    switch (currentTheme) {
        case 'dark':
            return val.color.dark;
        case 'light':
            return val.color.light;
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return val.color.dark;
    }

    return val.color.light;
}

const getBranchColors = branchEntries => Object.fromEntries(
    branchEntries.map(([key, val]) => [key, getDarkModeMatchingColor(val)])
);

const config = () => {
    const branchEntries = Object.entries(BRANCHES);

    const isMobile = window.innerWidth <= 720;

    return Object.freeze({
        MAIN_BRANCH: getMainBranch(),
        BRANCH_ORDER: getBranchOrder(),
        BRANCH_COLORS: getBranchColors(branchEntries),

        FALLBACK_COLOR: getDarkModeMatchingColor(FALLBACK_COLORS),
        EXPAND_BUTTON_ID: 'git-graph-expand-btn',
        GRAPH_CONTAINER_LEFT_PADDING: 2,
        BUTTON_HEIGHT_SPACE: 60,

        VERTICAL_Y_COMMIT_SPACING: isMobile ? 80 : 70,
        HORIZONTAL_LANE_GAP: isMobile ? 30 : 50,
    });
};

let isGraphExpanded = false;

const defineBranchColorsAsCssVariables = () => {
    const documentRoot = document.documentElement;
    Object.entries(config().BRANCH_COLORS).forEach(([name, column]) =>
        documentRoot.style.setProperty(`--branch-${name}`, column)
    );
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

const getLinkColor = (child, parent, isDotted, isFuture) => {
    if (isDotted && !isFuture) return config().FALLBACK_COLOR;
    const getBranchColor = (branch) => config().BRANCH_COLORS[branch] || config().FALLBACK_COLOR;
    const candidates = [parent?.branch, child?.branch, config().MAIN_BRANCH];
    const activeBranch = candidates.find(b => b && b !== config().MAIN_BRANCH) || config().MAIN_BRANCH;
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

const getLinkOpacity = isDotted => isDotted ? '0.4' : '0.95';

const drawLinkAsPath = (childNode, childPos, parentNode, parentPos, isDotted = false, isFuture = false) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    const d = isDotted
        ? `M ${childPos.x} ${childPos.y} L ${parentPos.x} ${parentPos.y}`
        : calculateKinkedPath(childNode, childPos, parentNode, parentPos);

    path.setAttribute('d', d);
    path.setAttribute('stroke', getLinkColor(childNode, parentNode, isDotted, isFuture));
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('opacity', getLinkOpacity(isDotted));

    if (isDotted) {
        path.setAttribute('stroke-dasharray', '4,6');
    }

    return path;
};

const isConnectionVisible = p => p.pos && p.node;

const isTopOfBranch = (commitNodes, childNode) => !commitNodes.some(other =>
    other.branch === childNode.branch && other.order > childNode.order
);

const childNodeIsLowerThanGlobalMax = (childNode, maxGlobalOrder) => childNode.order < maxGlobalOrder;

const getMaxGlobalOrder = commitNodes => Math.max(...commitNodes.map(n => n.order));

const drawUpwardDottedLink = (childPos, canvas, childNode) => {
    const virtualUpwardPos = {
        x: childPos.x,
        y: childPos.y - (config().VERTICAL_Y_COMMIT_SPACING * 0.7)
    };
    canvas.appendChild(drawLinkAsPath(childNode, childPos, childNode, virtualUpwardPos, true, true));
};

const drawDownwardDottedLink = (childNode, idPosition, allElements, childPos, canvas) => {
    const firstHiddenParent = childNode.parents
        .find(id => !idPosition.has(id) && allElements.some(el => el.dataset.id === id));

    if (!firstHiddenParent) return;

    const hiddenEl = allElements.find(el => el.dataset.id === firstHiddenParent);
    const virtualPos = {
        x: childPos.x,
        y: childPos.y + (config().VERTICAL_Y_COMMIT_SPACING * 0.7)
    };
    canvas.appendChild(drawLinkAsPath(childNode, childPos, mapCommitElement(hiddenEl), virtualPos, true, false));
};

const drawNode = (idPosition, childNode, commitNodes, canvas, allElements) => {
    const childPos = idPosition.get(childNode.id);
    if (!childPos) return;

    childNode.parents
        .map(id => ({id, pos: idPosition.get(id), node: commitNodes.find(n => n.id === id)}))
        .filter(p => isConnectionVisible(p))
        .forEach(p => canvas.appendChild(drawLinkAsPath(childNode, childPos, p.node, p.pos)));

    if (!isGraphExpanded) {
        drawDownwardDottedLink(childNode, idPosition, allElements, childPos, canvas);
    }

    const maxGlobalOrder = getMaxGlobalOrder(commitNodes);
    if (isTopOfBranch(commitNodes, childNode) && childNodeIsLowerThanGlobalMax(childNode, maxGlobalOrder)) {
        drawUpwardDottedLink(childPos, canvas, childNode);
    }
};

const drawNodes = (commitNodes, idPosition, canvas, allElements) => {
    commitNodes.forEach(childNode => drawNode(idPosition, childNode, commitNodes, canvas, allElements));
};

const updateCommitElement = (commitNode, {x, y}) => {
    const dot = commitNode.element.querySelector('.commit-dot');
    const message = commitNode.element.querySelector('.commit-message');
    const backgroundColor = config().BRANCH_COLORS[commitNode.branch] || config().FALLBACK_COLOR;

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
            meta.style.color = backgroundColor;
        }
    }
};

const generateBranchIndex = () => new Map(config().BRANCH_ORDER.map((name, i) => [name, i]));

const onGraphExtendButtonClick = () => () => {
    isGraphExpanded = !isGraphExpanded;
    rerenderGraph();
};

const updateExpandButton = (container) => {
    let expandButton = document.getElementById(config().EXPAND_BUTTON_ID);
    if (!expandButton) {
        expandButton = document.createElement('div');
        expandButton.id = config().EXPAND_BUTTON_ID;
        expandButton.addEventListener('click', onGraphExtendButtonClick());
        container.appendChild(expandButton);
    }
    expandButton.innerHTML = isGraphExpanded ? '&#8593; Collapse History' : '&#8595; Show Earlier History (2017-2021)';
};

const getIdPositions = (commitNodes, branchIndex) =>
    new Map(commitNodes.map((node, idx) => {
        const lane = branchIndex.get(node.branch) ?? 0;
        const x = config().GRAPH_CONTAINER_LEFT_PADDING + lane * config().HORIZONTAL_LANE_GAP;
        const y = config().VERTICAL_Y_COMMIT_SPACING / 2 + (commitNodes.length - 1 - idx) * config().VERTICAL_Y_COMMIT_SPACING;
        return [node.id, {x, y}];
    }));

const renderCommitNodes = (container, canvas) => {
    const allElements = Array.from(container.querySelectorAll('.commit'));
    const commitNodes = readInCommitNodes(container);
    const branchIndex = generateBranchIndex();
    const idPosition = getIdPositions(commitNodes, branchIndex);

    const totalHeight = Math.max(240, (commitNodes.length * config().VERTICAL_Y_COMMIT_SPACING) + config().BUTTON_HEIGHT_SPACE);
    container.style.minHeight = totalHeight + 'px';
    container.style.position = 'relative';

    canvas.setAttribute('width', container.clientWidth);
    canvas.setAttribute('height', container.clientHeight);

    commitNodes.forEach(node => {
        const coords = idPosition.get(node.id);
        if (coords) updateCommitElement(node, coords);
    });

    drawNodes(commitNodes, idPosition, canvas, allElements);
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

window.addEventListener('resize', () => rerenderGraph());

window.addEventListener('color-scheme-toggle', (event) => {
    if (event.detail.key !== 'theme') return;

    rerenderGraph();
});

window.addEventListener('storage', (event) => {
    if (event.key !== 'theme') return;

    document.documentElement.setAttribute('data-theme', event.newValue);
    rerenderGraph();
});

document.addEventListener("DOMContentLoaded", renderGitGraph);