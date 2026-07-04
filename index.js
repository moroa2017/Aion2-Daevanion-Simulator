(function () {
  let daevanionData = null; 
  let nodeIdSkillMap = null; 
  let currentClass = 'sword'; 
  let currentNode = 'nejakan';  
  let appState = {}; 
  let pointBudgets = {
    shared_devanion: 200, 
    ariel: 100,
    aspel: 100,
    markutan: 100,
    yustiel: 100
  };
  let optionOrderMap = {};
  let optionDisabledMap = {};
  let dijkstraCache = {};
  let classCapacities = {};
  let currentGridMap = null;
  let tooltipEl = null;
  let adjacencyCache = {};
  let staticOptionSummaryCache = {};
  
  class MinHeap {
    constructor() { this.heap = []; }
    push(val, priority) {
      this.heap.push({ val, priority });
      this.bubbleUp(this.heap.length - 1);
    }
    pop() {
      if (this.heap.length === 1) return this.heap.pop();
      const top = this.heap[0];
      this.heap[0] = this.heap.pop();
      this.sinkDown(0);
      return top;
    }
    isEmpty() { return this.heap.length === 0; }
    bubbleUp(idx) {
      while (idx > 0) {
        let pIdx = Math.floor((idx - 1) / 2);
        if (this.heap[idx].priority >= this.heap[pIdx].priority) break;
        let tmp = this.heap[idx];
        this.heap[idx] = this.heap[pIdx];
        this.heap[pIdx] = tmp;
        idx = pIdx;
      }
    }
    sinkDown(idx) {
      const len = this.heap.length;
      while (true) {
        let left = 2 * idx + 1;
        let right = 2 * idx + 2;
        let smallest = idx;
        if (left < len && this.heap[left].priority < this.heap[smallest].priority) smallest = left;
        if (right < len && this.heap[right].priority < this.heap[smallest].priority) smallest = right;
        if (smallest === idx) break;
        let tmp = this.heap[idx];
        this.heap[idx] = this.heap[smallest];
        this.heap[smallest] = tmp;
        idx = smallest;
      }
    }
  }
  const BOARD_ID_MAP = {
    nejakan: 81,
    jikel: 82,
    baizel: 83,
    trinil: 84,
    ariel: 85,
    aspel: 86,
    markutan: 87,
    yustiel: 88
  };
  const BOARD_NAME_MAP = {
    81: 'nejakan', 82: 'jikel', 83: 'baizel', 84: 'trinil',
    85: 'ariel', 86: 'aspel', 87: 'markutan', 88: 'yustiel',
    91: 'nejakan', 92: 'jikel', 93: 'baizel', 94: 'trinil',
    95: 'ariel', 96: 'aspel', 97: 'markutan', 98: 'yustiel'
  };
  const BOARD_GRADE_MAP = {
    nejakan: 'common', jikel: 'common', baizel: 'common', trinil: 'common',
    ariel: 'rare', aspel: 'rare',
    markutan: 'unique',
    yustiel: 'legend'
  };
  const START_ICON_MAP = {
    guardian: 'board_icon_start_templar.png',
    sword: 'board_icon_start_gladiator.png',
    assassin: 'board_icon_start_assassin.png',
    archer: 'board_icon_start_ranger.png',
    mage: 'board_icon_start_sorcerer.png',
    spirit: 'board_icon_start_elementalist.png',
    healer: 'board_icon_start_cleric.png',
    chanter: 'board_icon_start_chanter.png',
    brawler: 'board_icon_start_fighter.png'
  };
  const SHARED_BOARDS = ['nejakan', 'jikel', 'baizel', 'trinil'];
  const DEFAULT_PRIORITY_ORDER = {
    shared_devanion: [
      '전투 속도', '재시전 시간 감소', '피해 증폭', '추가 공격력', '다단 히트 적중',
      '치명타 피해 증폭', '피해 내성', '추가 방어력', '치명타 피해 내성', '다단 히트 저항',
      '명중', '회피', '공격력', '치명타', '방어력', '치명타 저항', '최대 생명력', '정신력'
    ],
    ariel: [
      'PVE 피해 증폭', 'PVE 피해 내성', '보스 피해 증폭', '보스 피해 내성',
      'PVE 공격력', '보스 공격력', 'PVE 방어력', '보스 방어력',
      'PVE 명중', 'PVE 회피', '최대 생명력', '정신력'
    ],
    aspel: [
      'PVP 피해 증폭', 'PVP 피해 내성', '상태이상 적중', '상태이상 저항',
      'PVP 공격력', 'PVP 치명타', 'PVP 명중', 'PVP 회피',
      'PVP 방어력', 'PVP 치명타 저항', '최대 생명력', '정신력'
    ],
    markutan: [
      '무기 피해 증폭', '무기 피해 내성', '철벽 관통', '철벽',
      '재생 관통', '재생', '생명력 증가', '공격력', '추가 공격력',
      '치명타', '명중', '방어력', '치명타 저항', '막기', '최대 생명력'
    ],
    yustiel: [
      '공격력 증가', '방어력 증가', '완벽', '완벽 저항',
      '최대 공격력', '막기 관통', '명중', '회피', '방어력', '막기',
      '최대 생명력', '정신력'
    ]
  };
  const GRADE_COSTS = {
    'None': 0,
    'Start': 0,
    'Common': 1,
    'Rare': 2,
    'Unique': 4,
    'Legend': 3
  };
  const GRADE_RANKS = {
    'None': 0,
    'Common': 1,
    'Rare': 2,
    'Unique': 3,
    'Legend': 4
  };
  async function init() {
    showOverlay();
    try {
      const version = '1.2.1';
      const [responseDb, responseMap] = await Promise.all([
        fetch('data/daevanion_data.json?v=' + version),
        fetch('data/node_id_skill_map.json?v=' + version)
      ]);
      if (!responseDb.ok) throw new Error('데바니온 데이터 파일을 불러오는 데 실패했습니다.');
      if (!responseMap.ok) throw new Error('스킬 매핑 데이터 파일을 불러오는 데 실패했습니다.');
      daevanionData = await responseDb.json();
      nodeIdSkillMap = await responseMap.json();
      Object.keys(daevanionData).forEach(classKey => {
        Object.keys(daevanionData[classKey]).forEach(boardIdStr => {
          const rawNodes = daevanionData[classKey][boardIdStr] || [];
          const gridMap = Array(16).fill(null).map(() => Array(16).fill(null));
          rawNodes.forEach(n => {
            gridMap[n.row][n.col] = n;
          });
          
          const fullNodes = [];
          for (let r = 1; r <= 15; r++) {
            for (let c = 1; c <= 15; c++) {
              if (gridMap[r][c]) {
                const n = gridMap[r][c];
                if (n.name === '최대 정신력') n.name = '정신력';
                else if (n.name === '최대 공격력, 최대 정신력') n.name = '최대 공격력, 정신력';
                if (!n.effectList) n.effectList = [];
                fullNodes.push(n);
              } else {
                fullNodes.push({
                  row: r, col: c,
                  type: 'None', grade: 'None', name: 'None',
                  effectList: []
                });
              }
            }
          }
          daevanionData[classKey][boardIdStr] = fullNodes;
        });
      });
      Object.keys(daevanionData).forEach(classKey => {
        Object.keys(BOARD_ID_MAP).forEach(boardName => {
          const boardId = classKey === 'brawler' ? BOARD_ID_MAP[boardName] + 10 : BOARD_ID_MAP[boardName];
          const nodes = daevanionData[classKey][boardId.toString()] || [];
          nodes.forEach(node => {
            if (node.type === 'SkillLevel') {
              const nId = node.nodeId.toString();
              const mappedNames = nodeIdSkillMap[nId];
              const translatedName = mappedNames && mappedNames[classKey];
              if (translatedName) {
                node.name = '스킬 레벨 상승 - ' + translatedName;
                if (node.effectList && node.effectList[0]) {
                  node.effectList[0].desc = translatedName + ' + 1';
                }
              }
            }
          });
        });
      });
      Object.keys(daevanionData).forEach(classKey => {
        classCapacities[classKey] = {};
        Object.keys(BOARD_ID_MAP).forEach(boardName => {
          const boardId = classKey === 'brawler' ? BOARD_ID_MAP[boardName] + 10 : BOARD_ID_MAP[boardName];
          const nodes = daevanionData[classKey][boardId.toString()] || [];
          const cap = nodes.reduce((sum, node) => {
            if (node.type === 'None' || node.type === 'Start') return sum;
            return sum + (GRADE_COSTS[node.grade] || 0);
          }, 0);
          classCapacities[classKey][boardId] = cap;
        });
      });
      Object.keys(daevanionData).forEach(classKey => {
        appState[classKey] = {};
        Object.keys(BOARD_ID_MAP).forEach(boardName => {
          const boardId = classKey === 'brawler' ? BOARD_ID_MAP[boardName] + 10 : BOARD_ID_MAP[boardName];
          appState[classKey][boardId] = {};
          const nodes = daevanionData[classKey][boardId.toString()] || [];
          nodes.forEach(node => {
            const key = `${node.row},${node.col}`;
            appState[classKey][boardId][key] = node.type === 'Start';
          });
        });
      });
      tooltipEl = document.getElementById('node-tooltip');
      buildAdjacencyCache();
      buildStaticOptionSummary();
      initBoardDOM();
      setupEventListeners();
      switchBoard('nejakan');
      updateGlobalSummary();
      hideOverlay();
    } catch (error) {
      console.error(error);
      showToast('데바니온 데이터를 초기화하는 과정에서 에러가 발생했습니다: ' + error.message);
      hideOverlay();
    }
  }
  
  function buildAdjacencyCache() {
    adjacencyCache = {};
    Object.keys(daevanionData).forEach(classKey => {
      adjacencyCache[classKey] = {};
      Object.keys(daevanionData[classKey]).forEach(boardIdStr => {
        const nodes = daevanionData[classKey][boardIdStr] || [];
        const gridMap = Array(16).fill(null).map(() => Array(16).fill(null));
        nodes.forEach(node => {
          gridMap[node.row][node.col] = node;
        });
        adjacencyCache[classKey][boardIdStr] = {};
        nodes.forEach(node => {
          if (node.type === 'None') return;
          const key = `${node.row},${node.col}`;
          const r = node.row;
          const c = node.col;
          const neighbors = [];
          const positions = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
          positions.forEach(([nr, nc]) => {
            if (nr >= 1 && nr <= 15 && nc >= 1 && nc <= 15) {
              const neighbor = gridMap[nr][nc];
              if (neighbor && neighbor.type !== 'None') {
                neighbors.push(`${nr},${nc}`);
              }
            }
          });
          adjacencyCache[classKey][boardIdStr][key] = neighbors;
        });
      });
    });
  }

  function buildStaticOptionSummary() {
    staticOptionSummaryCache = {};
    Object.keys(daevanionData).forEach(classKey => {
      staticOptionSummaryCache[classKey] = {};
      Object.keys(BOARD_ID_MAP).forEach(bName => {
        const boardId = classKey === 'brawler' ? BOARD_ID_MAP[bName] + 10 : BOARD_ID_MAP[bName];
        const nodes = daevanionData[classKey][boardId.toString()] || [];
        const summary = {};
        nodes.forEach(node => {
          if (node.type === 'None' || node.type === 'Start') return;
          const name = node.name;
          if (!summary[name]) {
            summary[name] = { name: name, maxGradeRank: GRADE_RANKS[node.grade] || 1, totalCount: 0 };
          }
          summary[name].totalCount += 1;
          const rank = GRADE_RANKS[node.grade] || 1;
          if (rank > summary[name].maxGradeRank) {
            summary[name].maxGradeRank = rank;
          }
        });
        staticOptionSummaryCache[classKey][bName] = summary;
      });
    });
  }
  function setupEventListeners() {
    document.querySelectorAll('.node-class-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const targetClass = tab.dataset.class;
        if (targetClass) {
          switchClass(targetClass);
        }
      });
    });
    document.querySelectorAll('.node-mini-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const targetBoard = e.target.dataset.board;
        if (targetBoard) {
          switchBoard(targetBoard);
        }
      });
    });
    document.querySelectorAll('.node-point-input').forEach(input => {
      const nodeKey = input.dataset.node;
      input.value = pointBudgets[nodeKey];
      const applyClamp = (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 0) val = 0;
        const limitSpan = document.getElementById(`pt-total-${nodeKey}`);
        if (limitSpan) {
          const maxCapacity = parseInt(limitSpan.textContent, 10) || 9999;
          if (val > maxCapacity) val = maxCapacity;
        }
        pointBudgets[nodeKey] = val;
        e.target.value = val;
        updateBudgetDisplay();
      };
      input.addEventListener('change', applyClamp);
      input.addEventListener('blur', applyClamp);
    });
    document.getElementById('node-calc-btn-main').addEventListener('click', runOptimization);
    document.getElementById('node-reset-btn-main').addEventListener('click', resetAllBoards);
  }
  function switchClass(classKey) {
    dijkstraCache = {};
    currentClass = classKey;
    optionOrderMap[classKey] = {};
    document.querySelectorAll('.node-class-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.class === classKey);
    });
    switchBoard(currentNode);
    updateGlobalSummary();
  }
  function switchBoard(boardName) {
    currentNode = boardName;
    document.querySelectorAll('.node-mini-tab').forEach(tab => {
      const bName = tab.dataset.board;
      const isActive = bName === boardName;
      tab.classList.toggle('active', isActive);
      const img = tab.querySelector('.node-mini-tab-icon');
      if (img && bName) {
        if (isActive) {
          const grade = BOARD_GRADE_MAP[bName] || 'common';
          img.src = `https://assets.playnccdn.com/static-aion2/characters/img/daevanion/board_icon_${grade}_open.png`;
        } else {
          img.src = `https://assets.playnccdn.com/static-aion2/characters/img/daevanion/board_icon_common.png`;
        }
      }
    });
    renderOptionList();
    renderBoardGrid();
    updateBudgetDisplay();
  }
  function getBudgetKey(boardName) {
    return SHARED_BOARDS.includes(boardName) ? 'shared_devanion' : boardName;
  }
  function calcPointsUsedOnBoard(boardName) {
    const boardId = currentClass === 'brawler' ? BOARD_ID_MAP[boardName] + 10 : BOARD_ID_MAP[boardName];
    const nodes = daevanionData[currentClass][boardId.toString()] || [];
    const activeState = appState[currentClass][boardId] || {};
    let total = 0;
    nodes.forEach(node => {
      const key = `${node.row},${node.col}`;
      if (activeState[key] && node.type !== 'Start') {
        total += GRADE_COSTS[node.grade] || 0;
      }
    });
    return total;
  }
  function calcPointsUsedOnCurrentGroup() {
    if (SHARED_BOARDS.includes(currentNode)) {
      return SHARED_BOARDS.reduce((sum, b) => sum + calcPointsUsedOnBoard(b), 0);
    }
    return calcPointsUsedOnBoard(currentNode);
  }
  function getGroupMaxPoints() {
    const groupKey = getBudgetKey(currentNode);
    return pointBudgets[groupKey] || 0;
  }
  function updateBudgetDisplay() {
    const budgetKeys = ['shared_devanion', 'ariel', 'aspel', 'markutan', 'yustiel'];
    budgetKeys.forEach(key => {
      const limitSpan = document.getElementById(`pt-total-${key}`);
      if (!limitSpan) return;
      let boards = [];
      if (key === 'shared_devanion') {
        boards = SHARED_BOARDS;
      } else {
        boards = [key];
      }
      const capacity = boards.reduce((sum, bName) => {
        const boardId = currentClass === 'brawler' ? BOARD_ID_MAP[bName] + 10 : BOARD_ID_MAP[bName];
        return sum + (classCapacities[currentClass][boardId] || 0);
      }, 0);
      limitSpan.textContent = capacity;
      const inputEl = document.querySelector(`.node-point-input[data-node="${key}"]`);
      if (inputEl) {
        let usage = 0;
        if (key === 'shared_devanion') {
          usage = SHARED_BOARDS.reduce((sum, b) => sum + calcPointsUsedOnBoard(b), 0);
        } else {
          usage = calcPointsUsedOnBoard(key);
        }
        const budgetLimit = pointBudgets[key] || 0;
        if (usage > budgetLimit) {
          inputEl.style.borderColor = 'hsl(0, 80%, 60%)';
          inputEl.style.color = 'hsl(0, 80%, 60%)';
        } else {
          inputEl.style.borderColor = '';
          inputEl.style.color = '';
        }
      }
    });
  }
  function initBoardDOM() {
    const boardEl = document.getElementById('node-board');
    if (!boardEl) return;
    boardEl.innerHTML = '';
    for (let r = 1; r <= 15; r++) {
      for (let c = 1; c <= 15; c++) {
        const nodeDiv = document.createElement('div');
        nodeDiv.className = 'node-item is-empty';
        nodeDiv.dataset.r = r;
        nodeDiv.dataset.c = c;
        nodeDiv.style.gridRow = r;
        nodeDiv.style.gridColumn = c;
        const iconImg = document.createElement('img');
        iconImg.className = 'node-icon-img';
        iconImg.style.display = 'none';
        nodeDiv.appendChild(iconImg);
        nodeDiv.addEventListener('click', () => {
          if (!currentGridMap) return;
          const node = currentGridMap[r]?.[c];
          if (node) {
            handleNodeClick(r, c, node, currentGridMap);
          }
        });
        boardEl.appendChild(nodeDiv);
      }
    }
  }
  function renderBoardGrid() {
    const boardEl = document.getElementById('node-board');
    if (!boardEl) return;
    let totalNonStart = 0;
    let activeNonStart = 0;
    const boardId = currentClass === 'brawler' ? BOARD_ID_MAP[currentNode] + 10 : BOARD_ID_MAP[currentNode];
    const nodes = daevanionData[currentClass][boardId.toString()] || [];
    const activeState = appState[currentClass][boardId] || {};
    const gridMap = Array(16).fill(null).map(() => Array(16).fill(null));
    nodes.forEach(node => {
      gridMap[node.row][node.col] = node;
    });
    currentGridMap = gridMap;
    const imgBaseUrl = 'https://assets.playnccdn.com/static-aion2/characters/img/daevanion/';
    const children = boardEl.children;
    for (let i = 0; i < children.length; i++) {
      const nodeDiv = children[i];
      const r = parseInt(nodeDiv.dataset.r, 10);
      const c = parseInt(nodeDiv.dataset.c, 10);
      const node = gridMap[r][c];
      if (!node || node.type === 'None') {
        nodeDiv.className = 'node-item is-empty';
        nodeDiv.querySelector('.node-icon-img').style.display = 'none';
        nodeDiv.onmouseenter = null;
        nodeDiv.onmousemove = null;
        nodeDiv.onmouseleave = null;
        continue;
      }
      const key = `${r},${c}`;
      const isActive = !!activeState[key];
      if (node.type !== 'None' && node.type !== 'Start') {
        totalNonStart++;
        if (isActive) {
          activeNonStart++;
        }
      }
      const isStart = node.type === 'Start';
      const cost = GRADE_COSTS[node.grade] || 0;
      nodeDiv.className = 'node-item';
      nodeDiv.dataset.key = key;
      if (isStart) {
        nodeDiv.classList.add('grade-start');
      } else {
        nodeDiv.classList.add(`grade-${node.grade.toLowerCase()}`);
      }
      if (isActive) {
        nodeDiv.classList.add('is-active');
      }
      const isReachable = isStart || isAdjacentToActive(r, c, gridMap, activeState);
      if (!isReachable && !isActive) {
        nodeDiv.classList.add('is-disabled');
      }
      const isNextCandidate = !isStart && !isActive && isReachable;
      if (isNextCandidate) {
        nodeDiv.classList.add('is-next-candidate');
      }
      let iconSrc = '';
      if (isStart) {
        iconSrc = imgBaseUrl + (START_ICON_MAP[currentClass] || 'board_icon_start_templar.png');
      } else {
        const grade = node.grade.toLowerCase();
        if (isActive) {
          iconSrc = imgBaseUrl + `board_icon_${grade}_open.png`;
        } else {
          iconSrc = imgBaseUrl + `board_icon_${grade}.png`;
        }
      }
      const iconImg = nodeDiv.querySelector('.node-icon-img');
      iconImg.src = iconSrc;
      iconImg.style.display = 'block';
      iconImg.alt = node.name || 'node icon';
      nodeDiv.onmouseenter = (e) => showNodeTooltip(e, node, isStart, cost);
      nodeDiv.onmousemove = (e) => positionTooltip(e);
      nodeDiv.onmouseleave = () => hideNodeTooltip();
    }
    const isAllCleared = totalNonStart > 0 && activeNonStart === totalNonStart;
    if (isAllCleared) {
      boardEl.classList.add('is-clear');
    } else {
      boardEl.classList.remove('is-clear');
    }
  }
  function handleNodeClick(r, c, node, gridMap) {
    const key = `${r},${c}`;
    const boardId = currentClass === 'brawler' ? BOARD_ID_MAP[currentNode] + 10 : BOARD_ID_MAP[currentNode];
    const activeState = appState[currentClass][boardId];
    const isActive = !!activeState[key];
    if (node.type === 'Start') return; 
    if (!isActive) {
      if (!isAdjacentToActive(r, c, gridMap, activeState)) {
        return; 
      }
      const cost = GRADE_COSTS[node.grade] || 0;
      const budgetKey = getBudgetKey(currentNode);
      const limit = pointBudgets[budgetKey];
      const currentUsed = calcPointsUsedOnCurrentGroup();
      if (currentUsed + cost > limit) {
        showToast('포인트 예산 한도를 초과하여 활성화할 수 없습니다.');
        return;
      }
      activeState[key] = true;
    } else {
      activeState[key] = false; 
      const nodes = daevanionData[currentClass][boardId.toString()] || [];
      const reachable = getReachableActiveNodes(nodes, activeState, boardId);
      let disconnected = false;
      nodes.forEach(n => {
        const k = `${n.row},${n.col}`;
        if (activeState[k] && !reachable[k]) {
          disconnected = true;
        }
      });
      if (disconnected) {
        activeState[key] = true;
        showToast('다른 활성화된 노드의 연결을 끊는 노드는 비활성화할 수 없습니다.');
        return;
      }
    }
    renderBoardGrid();
    updateBudgetDisplay();
    updateGlobalSummary();
    renderOptionList(); 
  }
  function isAdjacentToActive(r, c, gridMap, activeState) {
    const directions = [
      [-1, 0], [1, 0], [0, -1], [0, 1]
    ];
    for (let i = 0; i < directions.length; i++) {
      const nr = r + directions[i][0];
      const nc = c + directions[i][1];
      if (nr >= 1 && nr <= 15 && nc >= 1 && nc <= 15) {
        const neighbor = gridMap[nr][nc];
        if (neighbor && neighbor.type !== 'None' && activeState[`${nr},${nc}`]) {
          return true;
        }
      }
    }
    return false;
  }
  function getReachableActiveNodes(nodes, activeState, boardId) {
    const queue = [];
    const visited = {};
    nodes.forEach(node => {
      const key = `${node.row},${node.col}`;
      if (node.type === 'Start') {
        visited[key] = true;
        queue.push(key);
      }
    });
    while (queue.length > 0) {
      const currKey = queue.shift();
      const neighbors = adjacencyCache[currentClass][boardId.toString()][currKey] || [];
      neighbors.forEach(nextKey => {
        if (!visited[nextKey] && activeState[nextKey]) {
          visited[nextKey] = true;
          queue.push(nextKey);
        }
      });
    }
    return visited;
  }
  const KOREAN_BOARD_NAMES = {
    nejakan: '네자칸', jikel: '지켈', baizel: '바이젤', trinil: '트리니엘',
    ariel: '아리엘', aspel: '아스펠', markutan: '마르쿠탄', yustiel: '유스티엘'
  };
  function showNodeTooltip(e, node, isStart, cost) {
    tooltipEl.innerHTML = '';
    const titleSpan = document.createElement('div');
    titleSpan.className = 'node-tooltip-title';
    titleSpan.textContent = isStart ? `${KOREAN_BOARD_NAMES[currentNode] || currentNode} 시작점` : node.name;
    tooltipEl.appendChild(titleSpan);
    const descSpan = document.createElement('div');
    descSpan.className = 'node-tooltip-desc';
    descSpan.textContent = node.effectList.map(eff => eff.desc).join(', ') || '효과 없음';
    tooltipEl.appendChild(descSpan);
    if (!isStart) {
      const costSpan = document.createElement('div');
      costSpan.className = 'node-tooltip-cost';
      costSpan.textContent = `소모 포인트: ${cost} pt`;
      tooltipEl.appendChild(costSpan);
    }
    tooltipEl.style.opacity = '1';
    positionTooltip(e);
  }
  function positionTooltip(e) {
    const offset = 18;
    let x = e.clientX + offset;
    let y = e.clientY + offset;
    const tooltipWidth = tooltipEl.offsetWidth;
    const tooltipHeight = tooltipEl.offsetHeight;
    if (x + tooltipWidth > window.innerWidth) {
      x = e.clientX - tooltipWidth - offset;
    }
    if (y + tooltipHeight > window.innerHeight) {
      y = e.clientY - tooltipHeight - 6;
    }
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
  }
  function hideNodeTooltip() {
    tooltipEl.style.opacity = '0';
  }
  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = '⚠️';
    const msg = document.createElement('span');
    msg.className = 'toast-message';
    msg.textContent = message;
    toast.appendChild(icon);
    toast.appendChild(msg);
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('is-show');
    }, 10);
    setTimeout(() => {
      toast.classList.remove('is-show');
      setTimeout(() => {
        toast.remove();
      }, 350);
    }, 3000);
  }
  function renderOptionList() {
    const listEl = document.getElementById('node-option-list');
    if (!listEl) return;
    const groupKey = getBudgetKey(currentNode);
    if (!optionOrderMap[currentClass]) optionOrderMap[currentClass] = {};
    if (!optionDisabledMap[currentClass]) optionDisabledMap[currentClass] = {};
    const boardNames = SHARED_BOARDS.includes(currentNode) ? SHARED_BOARDS : [currentNode];
    const optionSummaryMap = getOptionSummary(boardNames);
    const savedOrder = optionOrderMap[currentClass][groupKey] || [];
    const skillsInThisBoard = Object.keys(optionSummaryMap)
      .filter(name => name.includes('스킬 레벨'))
      .sort((a, b) => {
        const rankA = optionSummaryMap[a].maxGradeRank || 0;
        const rankB = optionSummaryMap[b].maxGradeRank || 0;
        if (rankA !== rankB) {
          return rankB - rankA; 
        }
        return a.localeCompare(b, 'ko');
      });
    const hasInvalidSkill = savedOrder.some(name => name.includes('스킬 레벨') && !skillsInThisBoard.includes(name));
    const hasMissingSkill = skillsInThisBoard.some(name => !savedOrder.includes(name));
    let baseOrder = [];
    if (savedOrder.length && !hasInvalidSkill && !hasMissingSkill) {
      baseOrder = savedOrder;
    } else {
      const defaultList = DEFAULT_PRIORITY_ORDER[groupKey] || [];
      const evadeIdx = defaultList.indexOf('회피');
      if (evadeIdx !== -1) {
        baseOrder = [
          ...defaultList.slice(0, evadeIdx + 1),
          ...skillsInThisBoard,
          ...defaultList.slice(evadeIdx + 1)
        ];
      } else {
        baseOrder = [...defaultList, ...skillsInThisBoard];
      }
      optionOrderMap[currentClass][groupKey] = baseOrder;
    }
    const uniqueOptions = Object.values(optionSummaryMap);
    uniqueOptions.sort((a, b) => {
      const getSortWeight = (name) => {
        if (name === '정신력') return 999; 
        if (name === '최대 생명력' || name === '치명타 저항') return 990; 
        return 0;
      };
      const weightA = getSortWeight(a.name);
      const weightB = getSortWeight(b.name);
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      const idxA = baseOrder.indexOf(a.name);
      const idxB = baseOrder.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) {
        return idxA - idxB;
      }
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      const isSkillA = a.name.includes('스킬 레벨');
      const isSkillB = b.name.includes('스킬 레벨');
      if (isSkillA !== isSkillB) {
        return isSkillA ? -1 : 1;
      }
      const subOrder = ['공격력', '치명타', '방어력'];
      const subIdxA = subOrder.indexOf(a.name);
      const subIdxB = subOrder.indexOf(b.name);
      if (subIdxA !== -1 || subIdxB !== -1) {
        if (subIdxA === -1) return 1;
        if (subIdxB === -1) return -1;
        return subIdxA - subIdxB;
      }
      return b.maxGradeRank - a.maxGradeRank || a.name.localeCompare(b.name, 'ko');
    });
    const disabledMap = optionDisabledMap[currentClass][groupKey] || {};
    listEl.innerHTML = uniqueOptions.map(item => {
      const isDisabled = !!disabledMap[item.name];
      const isPicked = item.pickedCount >= item.totalCount;
      return `
        <div class="node-option-item ${isDisabled ? 'is-disabled' : ''} ${isPicked ? 'is-picked' : ''}" 
             draggable="true" data-name="${item.name}">
          <span class="node-option-dot g${item.maxGradeRank}"></span>
          <div class="node-option-text-wrap">
            <span class="node-option-text">${item.name}</span>
            <span class="node-option-count">${item.pickedCount}/${item.totalCount}</span>
          </div>
          <div class="node-option-move">
            <button class="node-option-move-btn btn-up" title="우선순위 올리기">▲</button>
            <button class="node-option-move-btn btn-down" title="우선순위 내리기">▼</button>
            <button class="node-option-move-btn node-option-remove-btn" title="활성화 제외">✕</button>
          </div>
        </div>
      `;
    }).join('');
    bindDragAndDropEvents(listEl, groupKey);
    bindPriorityClickEvents(listEl, groupKey);
  }
  function getOptionSummary(boardNames) {
    const summary = {};
    boardNames.forEach(bName => {
      const staticSumm = staticOptionSummaryCache[currentClass][bName] || {};
      Object.keys(staticSumm).forEach(optName => {
        if (!summary[optName]) {
          summary[optName] = {
            name: optName,
            maxGradeRank: staticSumm[optName].maxGradeRank,
            totalCount: 0,
            pickedCount: 0
          };
        }
        summary[optName].totalCount += staticSumm[optName].totalCount;
      });
      const boardId = currentClass === 'brawler' ? BOARD_ID_MAP[bName] + 10 : BOARD_ID_MAP[bName];
      const nodes = daevanionData[currentClass][boardId.toString()] || [];
      const activeState = appState[currentClass][boardId] || {};
      nodes.forEach(node => {
        if (node.type === 'None' || node.type === 'Start') return;
        const key = `${node.row},${node.col}`;
        if (activeState[key] && summary[node.name]) {
          summary[node.name].pickedCount += 1;
        }
      });
    });
    return summary;
  }
  let currentDraggedItem = null;
  function bindDragAndDropEvents(container, groupKey) {
    const items = container.querySelectorAll('.node-option-item');
    items.forEach(item => {
      item.addEventListener('dragstart', () => {
        currentDraggedItem = item;
        item.classList.add('is-dragging');
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('is-dragging');
        currentDraggedItem = null;
        saveOptionOrder(container, groupKey);
      });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);
        if (afterElement == null) {
          container.appendChild(currentDraggedItem);
        } else {
          container.insertBefore(currentDraggedItem, afterElement);
        }
      });
    });
  }
  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.node-option-item:not(.is-dragging)')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
  function saveOptionOrder(container, groupKey) {
    const order = [];
    container.querySelectorAll('.node-option-item').forEach(el => {
      order.push(el.dataset.name);
    });
    if (!optionOrderMap[currentClass]) optionOrderMap[currentClass] = {};
    optionOrderMap[currentClass][groupKey] = order;
  }
  function bindPriorityClickEvents(container, groupKey) {
    container.querySelectorAll('.node-option-item').forEach(item => {
      const name = item.dataset.name;
      item.querySelector('.btn-up').addEventListener('click', (e) => {
        e.stopPropagation();
        const prev = item.previousElementSibling;
        if (prev) {
          container.insertBefore(item, prev);
          saveOptionOrder(container, groupKey);
        }
      });
      item.querySelector('.btn-down').addEventListener('click', (e) => {
        e.stopPropagation();
        const next = item.nextElementSibling;
        if (next) {
          container.insertBefore(next, item);
          saveOptionOrder(container, groupKey);
        }
      });
      item.querySelector('.node-option-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!optionDisabledMap[currentClass]) {
          optionDisabledMap[currentClass] = {};
        }
        if (!optionDisabledMap[currentClass][groupKey]) {
          optionDisabledMap[currentClass][groupKey] = {};
        }
        optionDisabledMap[currentClass][groupKey][name] = !optionDisabledMap[currentClass][groupKey][name];
        renderOptionList();
      });
    });
  }
  function buildShortestPathTree(nodes, activeState, boardName) {
    const activeKeys = Object.keys(activeState).filter(k => activeState[k]).sort().join('|');
    const cacheKey = `${boardName}_${activeKeys}`;
    if (dijkstraCache[cacheKey]) {
      return dijkstraCache[cacheKey];
    }
    
    const boardId = currentClass === 'brawler' ? BOARD_ID_MAP[boardName] + 10 : BOARD_ID_MAP[boardName];
    const nodeMap = {};
    nodes.forEach(node => {
      nodeMap[`${node.row},${node.col}`] = node;
    });
    
    const dist = {};
    const prev = {};
    const visited = {};
    const pq = new MinHeap();
    
    Object.keys(nodeMap).forEach(key => {
      dist[key] = Infinity;
    });
    
    nodes.forEach(node => {
      const key = `${node.row},${node.col}`;
      if (node.type === 'Start' || activeState[key]) {
        dist[key] = 0;
        pq.push(key, 0);
      }
    });
    
    while (!pq.isEmpty()) {
      const { val: currKey, priority: currentDist } = pq.pop();
      if (currentDist > dist[currKey]) continue;
      
      visited[currKey] = true;
      const neighbors = adjacencyCache[currentClass][boardId.toString()][currKey] || [];
      neighbors.forEach(nextKey => {
        if (visited[nextKey]) return;
        const nextNode = nodeMap[nextKey];
        if (!nextNode) return;
        
        let stepCost = 0;
        if (nextNode.type !== 'Start' && !activeState[nextKey]) {
          stepCost = GRADE_COSTS[nextNode.grade] || 0;
        }
        
        const alt = dist[currKey] + stepCost;
        if (alt < dist[nextKey]) {
          dist[nextKey] = alt;
          prev[nextKey] = currKey;
          pq.push(nextKey, alt);
        }
      });
    }
    const result = { nodeMap, dist, prev };
    dijkstraCache[cacheKey] = result;
    return result;
  }
  function getCandidatesForLabel(nodes, activeState, targetLabel, boardName) {
    const tree = buildShortestPathTree(nodes, activeState, boardName);
    const candidates = [];
    nodes.forEach(node => {
      const key = `${node.row},${node.col}`;
      if (node.type === 'None' || node.type === 'Start') return;
      if (activeState[key]) return; 
      if (node.name !== targetLabel) return;
      if (tree.dist[key] === Infinity) return;
      const path = [];
      let cursor = key;
      while (cursor) {
        path.push(cursor);
        if (tree.dist[cursor] === 0) break;
        cursor = tree.prev[cursor];
      }
      path.reverse();
      let pathCost = 0;
      const pathNodeKeys = {};
      path.forEach(pk => {
        const pNode = tree.nodeMap[pk];
        if (pNode && pNode.type !== 'Start' && !activeState[pk]) {
          pathCost += GRADE_COSTS[pNode.grade] || 0;
          pathNodeKeys[pk] = true;
        }
      });
      candidates.push({
        key: key,
        path: path,
        cost: pathCost,
        gradeRank: GRADE_RANKS[node.grade] || 1,
        pathNodeKeys: pathNodeKeys,
        gain: 1,
        boardName: boardName
      });
    });
    candidates.sort((a, b) => {
      if (a.cost !== b.cost) return a.cost - b.cost;
      return b.gradeRank - a.gradeRank;
    });
    return candidates;
  }
  function collectCandidatesForBoards(boardNames, targetLabel, activeStateMap, remainingBudget) {
    const allCandidates = [];
    boardNames.forEach(bName => {
      const boardId = currentClass === 'brawler' ? BOARD_ID_MAP[bName] + 10 : BOARD_ID_MAP[bName];
      const nodes = daevanionData[currentClass][boardId.toString()] || [];
      const boardActiveState = activeStateMap[bName] || {};
      const cands = getCandidatesForLabel(nodes, boardActiveState, targetLabel, bName);
      cands.forEach(cand => {
        if (cand.cost <= remainingBudget) {
          allCandidates.push(cand);
        }
      });
    });
    allCandidates.sort((a, b) => {
      if (a.cost !== b.cost) return a.cost - b.cost;
      return b.gradeRank - a.gradeRank;
    });
    return allCandidates;
  }
  async function runOptimization() {
    dijkstraCache = {};
    showOverlay();
    await new Promise(resolve => setTimeout(resolve, 300));
    const budgetKeys = ['shared_devanion', 'ariel', 'aspel', 'markutan', 'yustiel'];
    budgetKeys.forEach(groupKey => {
      let boardNames = [];
      if (groupKey === 'shared_devanion') {
        boardNames = SHARED_BOARDS;
      } else {
        boardNames = [groupKey];
      }
      const limit = pointBudgets[groupKey] || 0;
      if (!optionOrderMap[currentClass]) optionOrderMap[currentClass] = {};
      if (!optionDisabledMap[currentClass]) optionDisabledMap[currentClass] = {};
      const savedOrder = optionOrderMap[currentClass][groupKey] || [];
      const optionSummaryMap = getOptionSummary(boardNames);
      const skillsInThisBoard = Object.keys(optionSummaryMap).filter(name => name.includes('스킬 레벨'));
      const hasInvalidSkill = savedOrder.some(name => name.includes('스킬 레벨') && !skillsInThisBoard.includes(name));
      const hasMissingSkill = skillsInThisBoard.some(name => !savedOrder.includes(name));
      let baseOrder = [];
      if (savedOrder.length && !hasInvalidSkill && !hasMissingSkill) {
        baseOrder = savedOrder;
      } else {
        const defaultList = DEFAULT_PRIORITY_ORDER[groupKey] || [];
        const evadeIdx = defaultList.indexOf('회피');
        if (evadeIdx !== -1) {
          baseOrder = [
            ...defaultList.slice(0, evadeIdx + 1),
            ...skillsInThisBoard,
            ...defaultList.slice(evadeIdx + 1)
          ];
        } else {
          baseOrder = [...defaultList, ...skillsInThisBoard];
        }
        optionOrderMap[currentClass][groupKey] = baseOrder;
      }
      const disabledMap = optionDisabledMap[currentClass][groupKey] || {};
      const activePriorityLabels = baseOrder.filter(lbl => !disabledMap[lbl]);
      const localActiveMap = {};
      boardNames.forEach(bName => {
        const boardId = currentClass === 'brawler' ? BOARD_ID_MAP[bName] + 10 : BOARD_ID_MAP[bName];
        const nodes = daevanionData[currentClass][boardId.toString()] || [];
        localActiveMap[bName] = {};
        nodes.forEach(node => {
          const key = `${node.row},${node.col}`;
          localActiveMap[bName][key] = node.type === 'Start';
        });
      });
      let remaining = limit;
      for (let i = 0; i < activePriorityLabels.length; i++) {
        const targetLabel = activePriorityLabels[i];
        while (remaining > 0) {
          const cands = collectCandidatesForBoards(boardNames, targetLabel, localActiveMap, remaining);
          if (cands.length === 0) break;
          const best = cands[0];
          best.path.forEach(pk => {
            localActiveMap[best.boardName][pk] = true;
          });
          remaining -= best.cost;
        }
      }
      while (remaining > 0) {
        let bestCandidate = null;
        let minCost = Infinity;
        boardNames.forEach(bName => {
          const boardId = currentClass === 'brawler' ? BOARD_ID_MAP[bName] + 10 : BOARD_ID_MAP[bName];
          const nodes = daevanionData[currentClass][boardId.toString()] || [];
          const boardActiveState = localActiveMap[bName] || {};
          const tree = buildShortestPathTree(nodes, boardActiveState, bName);
          nodes.forEach(node => {
            const key = `${node.row},${node.col}`;
            if (node.type === 'None' || node.type === 'Start') return;
            if (boardActiveState[key]) return;
            if (tree.dist[key] === Infinity) return;
            const path = [];
            let cursor = key;
            while (cursor) {
              path.push(cursor);
              if (tree.dist[cursor] === 0) break;
              cursor = tree.prev[cursor];
            }
            path.reverse();
            let pathCost = 0;
            path.forEach(pk => {
              const pNode = tree.nodeMap[pk];
              if (pNode && pNode.type !== 'Start' && !boardActiveState[pk]) {
                pathCost += GRADE_COSTS[pNode.grade] || 0;
              }
            });
            if (pathCost > 0 && pathCost <= remaining && pathCost < minCost) {
              minCost = pathCost;
              bestCandidate = {
                boardName: bName,
                path: path,
                cost: pathCost
              };
            }
          });
        });
        if (!bestCandidate) break;
        bestCandidate.path.forEach(pk => {
          localActiveMap[bestCandidate.boardName][pk] = true;
        });
        remaining -= bestCandidate.cost;
      }
      boardNames.forEach(bName => {
        const boardId = currentClass === 'brawler' ? BOARD_ID_MAP[bName] + 10 : BOARD_ID_MAP[bName];
        appState[currentClass][boardId] = localActiveMap[bName];
      });
    });
    renderBoardGrid();
    updateBudgetDisplay();
    updateGlobalSummary();
    renderOptionList();
    hideOverlay();
  }
  function resetAllBoards() {
    dijkstraCache = {};
    Object.keys(BOARD_ID_MAP).forEach(bName => {
      const boardId = currentClass === 'brawler' ? BOARD_ID_MAP[bName] + 10 : BOARD_ID_MAP[bName];
      const nodes = daevanionData[currentClass][boardId.toString()] || [];
      appState[currentClass][boardId] = {};
      nodes.forEach(node => {
        const key = `${node.row},${node.col}`;
        appState[currentClass][boardId][key] = node.type === 'Start';
      });
    });
    renderBoardGrid();
    updateBudgetDisplay();
    updateGlobalSummary();
    renderOptionList();
  }
  function updateGlobalSummary() {
    const statsSummary = {};
    const skillsSummary = {};
    Object.keys(BOARD_ID_MAP).forEach(bName => {
      const boardId = currentClass === 'brawler' ? BOARD_ID_MAP[bName] + 10 : BOARD_ID_MAP[bName];
      const nodes = daevanionData[currentClass][boardId.toString()] || [];
      const activeState = appState[currentClass][boardId] || {};
      nodes.forEach(node => {
        const key = `${node.row},${node.col}`;
        if (!activeState[key] || node.type === 'Start' || node.type === 'None') return;
        node.effectList.forEach(eff => {
          const desc = eff.desc;
          if (!desc) return;
          if (node.type === 'SkillLevel') {
            const match = desc.match(/^(.+?)\s*\+(\d+)/);
            if (match) {
              const skillName = match[1].trim();
              const level = parseInt(match[2], 10);
              skillsSummary[skillName] = (skillsSummary[skillName] || 0) + level;
            } else {
              skillsSummary[desc] = (skillsSummary[desc] || 0) + 1;
            }
          } else {
            const match = desc.match(/^(.+?)\s*\+([\d.]+)(%?)/);
            if (match) {
              const statName = match[1].trim();
              const val = parseFloat(match[2]);
              const isPercent = match[3] === '%';
              const statKey = `${statName}${isPercent ? '%' : ''}`;
              statsSummary[statKey] = (statsSummary[statKey] || 0) + val;
            } else {
              statsSummary[desc] = (statsSummary[desc] || 0) + 1;
            }
          }
        });
      });
    });
    const summaryGridEl = document.getElementById('node-summary-grid');
    const summaries = [];
    Object.keys(statsSummary).forEach(key => {
      const val = statsSummary[key];
      const displayVal = key.endsWith('%') ? `+${val.toFixed(1)}%` : `+${val}`;
      const displayName = key.replace('%', '');
      summaries.push({ name: displayName, val: displayVal });
    });
    Object.keys(skillsSummary).forEach(key => {
      const val = skillsSummary[key];
      summaries.push({ name: key, val: `+${val}` });
    });
    if (summaries.length === 0) {
      summaryGridEl.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;">활성화된 스탯이 없습니다.</div>';
    } else {
      summaryGridEl.innerHTML = summaries.map(item => {
        return `
          <div class="active-row">
            <span class="active-row-name">${item.name}</span>
            <span class="active-row-val">${item.val}</span>
          </div>
        `;
      }).join('');
    }
  }
  function showOverlay() {
    document.getElementById('node-calc-overlay').classList.add('open');
  }
  function hideOverlay() {
    document.getElementById('node-calc-overlay').classList.remove('open');
  }
  window.addEventListener('DOMContentLoaded', init);
})();