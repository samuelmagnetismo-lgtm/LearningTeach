// --- VARIABLES GLOBALES Y TENSIONES ---
let scene, camera, renderer, controls;
let motorMesh, rotorMesh, beltMesh, vfdMesh;
let currentModule = 'power';

// Estado del Sistema
let state = {
  lotoLocked: false,
  running: false,
  fault: null, // null, 'phase_loss', 'overload', 'ground'
  poles: 4,
  terminalConfig: 'delta',
  targetFreq: 60,
  currentFreq: 0,
  rpm: 0,
  amps: 0,
  dmmMode: 'vac'
};

// --- INICIALIZACIÓN DE LA ESCENA 3D ---
function init3D() {
  const container = document.getElementById('canvas-container');
  
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090a0f);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(3, 2.5, 4.5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  
  // Luces
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(5, 12, 8);
  dirLight.castShadow = true;
  scene.add(dirLight);

  // Construir Escenario
  buildEnvironment();
  buildMotor();
  buildCabinet();
  buildConveyor();

  setupEvents();
  animate();
}

// --- CONSTRUCCIÓN DE MODELOS 3D ---
function buildEnvironment() {
  const floorGeo = new THREE.PlaneGeometry(15, 15);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1c23, roughness: 0.8 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.8;
  scene.add(floor);
}

function buildMotor() {
  const motorGroup = new THREE.Group();

  // Estator
  const bodyGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.1, 16);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, metalness: 0.5 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.rotation.z = Math.PI / 2;
  motorGroup.add(body);

  // Bornera Superior
  const boxGeo = new THREE.BoxGeometry(0.3, 0.2, 0.3);
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.set(0, 0.55, 0);
  motorGroup.add(box);

  // Rotor / Eje
  const shaftGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.6, 12);
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 });
  rotorMesh = new THREE.Mesh(shaftGeo, shaftMat);
  rotorMesh.rotation.z = Math.PI / 2;
  motorGroup.add(rotorMesh);

  motorGroup.position.set(1.2, 0, 0);
  scene.add(motorGroup);
}

function buildCabinet() {
  const cabinetGeo = new THREE.BoxGeometry(1.2, 1.8, 0.4);
  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x3a3d4d });
  const cabinet = new THREE.Mesh(cabinetGeo, cabinetMat);
  cabinet.position.set(-1.2, 0.1, 0);
  scene.add(cabinet);

  // VFD Pantalla en Gabinete
  const vfdGeo = new THREE.BoxGeometry(0.4, 0.5, 0.1);
  const vfdMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  vfdMesh = new THREE.Mesh(vfdGeo, vfdMat);
  vfdMesh.position.set(-1.2, 0.3, 0.21);
  scene.add(vfdMesh);
}

function buildConveyor() {
  const beltGeo = new THREE.BoxGeometry(2.5, 0.1, 0.6);
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  beltMesh = new THREE.Mesh(beltGeo, beltMat);
  beltMesh.position.set(2.2, -0.4, 0);
  scene.add(beltMesh);
}

// --- BUCLE DE SIMULACIÓN Y FÍSICA ---
function animate() {
  requestAnimationFrame(animate);

  // Cálculo de Aceleración y Rampa VFD
  if (state.running && !state.fault && !state.lotoLocked) {
    state.currentFreq += (state.targetFreq - state.currentFreq) * 0.04;
  } else {
    state.currentFreq += (0 - state.currentFreq) * 0.06;
  }

  // Sincronismo: RPM = (120 * f) / Polos
  const syncRPM = (120 * state.currentFreq) / state.poles;
  const slip = state.currentFreq > 0 ? 0.04 : 0;
  state.rpm = Math.max(0, syncRPM * (1 - slip));

  // Giro físico del Rotor 3D
  if (rotorMesh) {
    rotorMesh.rotation.x += (state.rpm / 60) * 0.1;
  }

  // Corriente RMS (A)
  if (state.currentFreq > 0.5) {
    state.amps = (state.currentFreq / 60) * (9.0 / (state.poles / 2)) + (Math.random() * 0.1);
  } else {
    state.amps = 0;
  }

  updateDashboard();
  updateMultimeter();
  controls.update();
  renderer.render(scene, camera);
}

// --- ACTUALIZACIÓN DE INTERFAZ Y MULTÍMETRO ---
function updateDashboard() {
  const statusEl = document.getElementById('val-status');
  if (state.lotoLocked) {
    statusEl.innerText = 'BLOQUEADO (LOTO)';
    statusEl.style.color = '#f44336';
  } else if (state.fault) {
    statusEl.innerText = 'FALLA: ' + state.fault.toUpperCase();
    statusEl.style.color = '#ffa000';
  } else if (state.currentFreq > 1) {
    statusEl.innerText = 'OPERANDO';
    statusEl.style.color = '#4caf50';
  } else {
    statusEl.innerText = 'DETENIDO';
    statusEl.style.color = '#ffffff';
  }

  document.getElementById('val-freq').innerText = state.currentFreq.toFixed(1);
  document.getElementById('val-rpm').innerText = Math.round(state.rpm);
  document.getElementById('val-amps').innerText = state.amps.toFixed(1);
  document.getElementById('val-torque').innerText = (state.amps * 0.8).toFixed(1);
}

function updateMultimeter() {
  const screen = document.getElementById('dmm-value');
  const unit = document.getElementById('dmm-unit');

  if (state.lotoLocked) {
    screen.innerText = '0.0';
    unit.innerText = 'V AC';
    return;
  }

  if (state.dmmMode === 'vac') {
    screen.innerText = state.running ? (state.fault === 'phase_loss' ? '127.0' : '220.4') : '0.0';
    unit.innerText = 'V AC';
  } else if (state.dmmMode === 'vdc') {
    screen.innerText = state.running ? '24.0' : '0.0';
    unit.innerText = 'V DC';
  } else if (state.dmmMode === 'cont') {
    screen.innerText = state.fault === 'ground' ? 'SHORT' : 'OPEN';
    unit.innerText = 'Ω';
  }
}

// --- EVENTOS DE INTERACCIÓN ---
function setupEvents() {
  // Navegación entre Módulos
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentModule = e.target.dataset.module;

      // Visibilidad de controles por módulo
      document.getElementById('vfd-slider-box').classList.toggle('hidden', currentModule !== 'vfd');
      document.getElementById('panel-plc').classList.toggle('hidden', currentModule !== 'plc');
      state.targetFreq = currentModule === 'vfd' ? parseFloat(document.getElementById('slider-freq').value) : 60;
    });
  });

  // Botón LOTO
  const lotoBtn = document.getElementById('btn-loto');
  lotoBtn.addEventListener('click', () => {
    state.lotoLocked = !state.lotoLocked;
    if (state.lotoLocked) {
      state.running = false;
      lotoBtn.innerText = '🔒 LOTO: BLOQUEADO';
      lotoBtn.className = 'loto-btn locked';
    } else {
      lotoBtn.innerText = '🔓 LOTO: DESBLOQUEADO';
      lotoBtn.className = 'loto-btn unlocked';
    }
  });

  // Arranque / Parada
  document.getElementById('btn-start').addEventListener('click', () => {
    if (!state.lotoLocked && !state.fault) state.running = true;
  });

  document.getElementById('btn-stop').addEventListener('click', () => {
    state.running = false;
  });

  // Modos de Multímetro
  document.querySelectorAll('.btn-dmm').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.dmmMode = e.target.dataset.mode;
    });
  });

  // Selección de Polos y Slider VFD
  document.getElementById('select-poles').addEventListener('change', (e) => {
    state.poles = parseInt(e.target.value);
  });

  document.getElementById('slider-freq').addEventListener('input', (e) => {
    document.getElementById('vfd-hz').innerText = e.target.value;
    if (currentModule === 'vfd') state.targetFreq = parseFloat(e.target.value);
  });

  // Diagnóstico de Averías
  document.getElementById('btn-gen-fault').addEventListener('click', () => {
    const faults = ['phase_loss', 'overload', 'ground'];
    state.fault = faults[Math.floor(Math.random() * faults.length)];
    state.running = false;
    document.getElementById('fault-status').innerText = 'Avería Generada: Mida con el DMM';
    document.getElementById('fault-status').style.color = '#ffa000';
  });

  document.getElementById('btn-fix-fault').addEventListener('click', () => {
    state.fault = null;
    document.getElementById('fault-status').innerText = 'Sistema Normal / Reparado';
    document.getElementById('fault-status').style.color = '#4caf50';
  });

  window.addEventListener('resize', () => {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}

// Arrancar simulación
window.onload = init3D;