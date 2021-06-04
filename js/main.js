let instructions = `
grid on
material matcap

reset
lsys FF+FFFFF
translate 10 0 0
lsys FF+FFF+FFFFF
extrude 5
`;

document.getElementById("code").textContent = instructions;

const MAX_WIDTH = 256;
const MAX_HEIGHT = 256;
const MAX_DEPTH = 256;

const LINE_RE = /^(\s*)([a-z][a-z0-9]+)\s*(.*)\s*$/;

const volume = new Uint8Array(MAX_WIDTH * MAX_HEIGHT * MAX_DEPTH);

let currentGroup = 1;
let currentLine = 0;

const vset = (x, y, z) => {
  if (x < 0 || x >= MAX_WIDTH) return;
  if (y < 0 || y >= MAX_HEIGHT) return;
  if (z < 0 || z >= MAX_DEPTH) return;
  volume[x * (MAX_HEIGHT * MAX_DEPTH) + y * MAX_DEPTH + z] = currentGroup;
};
const vunset = (x, y, z) => {
  if (x < 0 || x >= MAX_WIDTH) return;
  if (y < 0 || y >= MAX_HEIGHT) return;
  if (z < 0 || z >= MAX_DEPTH) return;
  volume[x * (MAX_HEIGHT * MAX_DEPTH) + y * MAX_DEPTH + z] = 0;
};

const vfull = (x, y, z) => {
  if (x < 0 || x >= MAX_WIDTH) return false;
  if (y < 0 || y >= MAX_HEIGHT) return false;
  if (z < 0 || z >= MAX_DEPTH) return false;
  return volume[x * (MAX_HEIGHT * MAX_DEPTH) + y * MAX_DEPTH + z] !== 0;
};

const vingroup = (x, y, z, group) => {
  if (x < 0 || x >= MAX_WIDTH) return false;
  if (y < 0 || y >= MAX_HEIGHT) return false;
  if (z < 0 || z >= MAX_DEPTH) return false;
  if (group === -1) {
    return volume[x * (MAX_HEIGHT * MAX_DEPTH) + y * MAX_DEPTH + z] !== 0;
  } else {
    return volume[x * (MAX_HEIGHT * MAX_DEPTH) + y * MAX_DEPTH + z] === group;
  }
};

const canvas = document.querySelector("canvas.webgl");
const scene = new THREE.Scene();

const textureLoader = new THREE.TextureLoader();
const matcapTexture = textureLoader.load("./img/matcap_6.png");

const geometryGroup = new THREE.Group();
scene.add(geometryGroup);

// const boxGeometry = new THREE.BoxBufferGeometry(0.98, 0.98, 0.98);
const boxGeometry = new THREE.BoxBufferGeometry(0.99, 0.99, 0.99);
// const boxGeometry = new THREE.BoxBufferGeometry(1, 1, 1);

let boxMaterial;

const gridHelper = new THREE.GridHelper(256, 256, "lightgrey", "lightgrey");
gridHelper.position.y = -0.5;
gridHelper.visible = false;
scene.add(gridHelper);

//500, 500, "lightgrey", "lightgrey"

buildGeometry();

const bounds = canvas.parentElement.getBoundingClientRect();
const globalSize = {
  width: bounds.width,
  height: bounds.height,
};

window.addEventListener("resize", () => {
  // Update sizes
  const bounds = canvas.parentElement.getBoundingClientRect();

  globalSize.width = bounds.width;
  globalSize.height = bounds.height;

  // Update camera
  perspCamera.aspect = globalSize.width / globalSize.height;
  perspCamera.updateProjectionMatrix();

  orthoCamera.aspect = globalSize.width / globalSize.height;
  orthoCamera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(globalSize.width, globalSize.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// PERSPECTIVE CAMERA
const perspCamera = new THREE.PerspectiveCamera(
  75,
  globalSize.width / globalSize.height,
  1,
  1024
);
perspCamera.position.y = 5;
perspCamera.position.z = 15;
scene.add(perspCamera);

// ORTHOGRAPIC CAMERA
const orthoCamera = new THREE.OrthographicCamera(-20, 20, 20, -20, 1, 1024);
orthoCamera.position.y = 5;
orthoCamera.position.z = 15;
scene.add(orthoCamera);

let currentCamera = perspCamera;

const perspControls = new THREE.OrbitControls(perspCamera, canvas);
const orthoControls = new THREE.OrbitControls(orthoCamera, canvas);

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
const svgRenderer = new THREE.SVGRenderer();
svgRenderer.overdraw = 0.0; // Maak dit groter of kleiner als er gaten tussen de blokken zijn

renderer.setSize(globalSize.width, globalSize.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

function debounce(func, timeout) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

function animate() {
  renderer.render(scene, currentCamera);
  window.requestAnimationFrame(animate);
}
animate();

function downloadText(filename, text) {
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8, " + encodeURIComponent(text)
  );
  element.setAttribute("download", filename);
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

function renderSvg() {
  const svgScene = buildSvgScene();
  svgRenderer.setSize(globalSize.width, globalSize.height);
  svgRenderer.render(svgScene, currentCamera);
  let svgCode = svgRenderer.domElement.outerHTML;
  svgCode = svgCode.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  downloadText("export.svg", svgCode);
}

function clearError() {
  document.getElementById("error").textContent = "";
}

function setError(error) {
  document.getElementById("error").textContent = error;
  console.error();
}

function buildVolume() {
  volume.fill(0);
  currentGroup = 1;
  boxMaterial = new THREE.MeshMatcapMaterial();
  boxMaterial.matcap = matcapTexture;

  const lines = instructions.trim().split("\n");

  let tx = Math.round(MAX_WIDTH / 2);
  let ty = Math.round(MAX_HEIGHT / 2);
  let tz = Math.round(MAX_DEPTH / 2);

  let line = 0;

  let commandMap = {
    box: (args) => {
      if (args.length !== 3) {
        setError(
          `Line ${currentLine}: box needs three arguments, e.g. box 2 4 5`
        );
        return;
      }
      const width = parseInt(args[0]);
      const height = parseInt(args[1]);
      const depth = parseInt(args[2]);
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          for (let z = 0; z < depth; z++) {
            vset(tx + x, ty + y, tz + z);
          }
        }
      }
    },
    plane: (args) => {
      if (args.length !== 2) {
        setError(
          `Line ${currentLine}: plane needs two arguments, e.g. plane 4 8`
        );
        return;
      }
      const width = parseInt(args[0]);
      const depth = parseInt(args[1]);
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < depth; z++) {
          vset(tx + x, ty, tz + z);
        }
      }
    },
    extrude: (args) => {
      if (args.length !== 1 && args.length !== 3) {
        setError(
          `Line ${currentLine}: extrude needs one or three arguments, e.g. 'extrude 10' or 'extrude 10 group 3'`
        );
        return;
      }
      let groupToCheck = -1;
      if (args.length === 3) {
        if (args[1] !== "group") {
          setError(
            `Line ${currentLine}: extrude needs a group argument, e.g. 'extrude 10 group 3'`
          );
          return;
        }
        groupToCheck = parseInt(args[2]);
        if (groupToCheck === 0) {
          setError(`Line ${currentLine}: extrude group can not be zero.`);
          return;
        }
      }
      const height = parseInt(args[0]);
      for (let x = 0; x < MAX_WIDTH; x++) {
        for (let y = MAX_HEIGHT - 1; y >= 0; y--) {
          for (let z = 0; z < MAX_DEPTH; z++) {
            if (vingroup(x, y, z, groupToCheck)) {
              for (let yy = y; yy < y + height; yy++) {
                vset(x, yy, z);
              }
            }
          }
        }
      }
    },
    translate: (args) => {
      if (args.length !== 3) {
        setError(
          `Line ${currentLine}: translate needs three arguments, e.g. translate 2 4 5`
        );
        return;
      }
      tx += parseInt(args[0]);
      ty += parseInt(args[1]);
      tz += parseInt(args[2]);
    },
    reset: () => {
      tx = Math.round(MAX_WIDTH / 2);
      ty = Math.round(MAX_HEIGHT / 2);
      tz = Math.round(MAX_DEPTH / 2);
    },
    lsys: (args) => {
      buildLSystem(args[0], tx, ty, tz);
    },
    group: (args) => {
      if (args.length !== 1) {
        setError(`Line ${currentLine}: group needs one argument, e.g. group 5`);
        return;
      }
      currentGroup = parseInt(args[0]);
    },
    material: (args) => {
      if (args.length !== 1 && args.length !== 2) {
        setError(
          `Line ${currentLine}: material needs one or two argument(s), e.g. material wireframe or material solid blue`
        );
        return;
      }
      if (args[0] === "wireframe") {
        boxMaterial = new THREE.MeshBasicMaterial({ color: "black" });
        boxMaterial.wireframe = true;
      } else if (args[0] === "matcap") {
        boxMaterial = new THREE.MeshMatcapMaterial();
        boxMaterial.matcap = matcapTexture;
      } else if (args[0] === "solid") {
        let customColor = "black";
        if (args.length === 2) {
          customColor = args[1];
        }
        boxMaterial = new THREE.MeshBasicMaterial({ color: customColor });
      } else {
        setError(`Line ${currentLine}: material got an unknown argument.`);
        return;
      }
    },

    background: (args) => {
      if (args.length !== 1) {
        setError(
          `Line ${currentLine}: background needs one argument, e.g. background blue`
        );
        return;
      }
      let customColor = args[0];
      scene.background = new THREE.Color(customColor);
    },

    grid: (args) => {
      if (args.length !== 1) {
        setError(`Line ${currentLine}: grid needs one argument, e.g. grid on`);
        return;
      }
      if (args[0] === "on") {
        gridHelper.visible = true;
      } else if (args[0] === "off") {
        gridHelper.visible = false;
      } else {
        setError(`Line ${currentLine}: grid got an unknown argument.`);
        return;
      }
    },

    camera: (args) => {
      if (args.length !== 1) {
        setError(
          `Line ${currentLine}: camera needs one argument, e.g. camera ortho`
        );
        return;
      }
      if (args[0] === "ortho") {
        currentCamera = orthoCamera;
      } else if (args[0] === "persp" || args[0] === "perspective") {
        currentCamera = perspCamera;
      } else {
        setError(
          `Line ${currentLine}: camera needs to be ortho or persp, e.g. camera ortho`
        );
        return;
      }
    },
  };

  try {
    const statements = parseCode(instructions, commandMap);
    executeStatements(statements, commandMap);
  } catch (e) {
    setError(e.stack);
  }
}

function parseCode(source, commandMap) {
  const lines = source.split("\n");
  const statements = [];
  let currentIndentLevel = 0;
  let currentFunction = null;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trimEnd();
    if (line.trim().length === 0) continue;
    if (line.trim().startsWith("#")) continue;
    const result = LINE_RE.exec(line);
    if (!result) {
      throw new Error(
        `[Line ${lineIndex + 1}]: I don't understand "${currentLine}".`
      );
    }
    let [_, indent, command, args] = result;
    args = args.split(/\s+/);
    const indentLevel = indent.length / 2;
    if (Math.floor(indentLevel) !== indentLevel) {
      throw new Error(
        `[Line ${lineIndex + 1}]: Invalid indent (not multiple of 2).`
      );
    }
    if (currentIndentLevel !== indentLevel) {
      if (!currentFunction) {
        throw new Error(
          `[Line ${lineIndex + 1}]: Indent changed, but not in function.`
        );
      }
      currentFunction = null;
      currentIndentLevel = 0;
    }
    if (command === "fn") {
      const name = args[0];
      currentFunction = {
        args: args.slice(1),
        statements: [],
      };
      commandMap[name] = currentFunction;
      currentIndentLevel = 1;
    } else {
      const statement = { command, args, line: lineIndex + 1 };
      if (currentFunction) {
        currentFunction.statements.push(statement);
      } else {
        statements.push(statement);
      }
    }
  }
  return statements;
}

function executeStatements(statements, commandMap) {
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    currentLine = statement.line;
    const fn = commandMap[statement.command];
    if (typeof fn === "function") {
      fn(statement.args);
    } else if (typeof fn === "object") {
      // FIXME do something with scope args here
      executeStatements(fn.statements, commandMap);
    } else {
      throw new Error(
        `[Line ${statement.line}]: Command "${statement.command}" not found.`
      );
    }
  }
}

function buildLSystem(rule, startTx, startTy, startTz) {
  let tx = startTx;
  let ty = startTy;
  let tz = startTz;

  let angle = 0;

  for (let letter of rule) {
    if (letter === "F") {
      vset(tx, ty, tz);
      tx += Math.round(Math.cos(angle));
      ty += 0;
      tz += Math.round(Math.sin(angle));
    } else if (letter === "f") {
      tx += Math.round(Math.cos(angle));
      ty += 0;
      tz += Math.round(Math.sin(angle));
    } else if (letter === "+") {
      angle += Math.PI / 2;
    } else if (letter === "-") {
      angle -= Math.PI / 2;
    }
  }
}

function buildGeometry() {
  clearError();
  scene.background = new THREE.Color("white");
  gridHelper.visible = true;

  while (geometryGroup.children.length) {
    geometryGroup.remove(geometryGroup.children[0]);
  }
  geometryGroup.position.set(-MAX_WIDTH / 2, -MAX_HEIGHT / 2, -MAX_DEPTH / 2);

  // buildLSystem();
  buildVolume();

  let boxCount = 0;
  for (let i = 0; i < volume.length; i++) {
    if (volume[i]) boxCount++;
  }

  const mesh = new THREE.InstancedMesh(boxGeometry, boxMaterial, boxCount);
  geometryGroup.add(mesh);

  let index = 0;
  for (let x = 0; x < MAX_WIDTH; x++) {
    for (let y = 0; y < MAX_HEIGHT; y++) {
      for (let z = 0; z < MAX_DEPTH; z++) {
        if (vfull(x, y, z)) {
          const m = new THREE.Matrix4();
          m.makeTranslation(x, y, z);
          mesh.setMatrixAt(index, m);
          index++;
        }
      }
    }
  }
}

function buildSvgScene() {
  const svgScene = new THREE.Scene();
  if (gridHelper.visible) {
    console.log("show grid heper");
    const svgGridHelper = new THREE.GridHelper(
      256,
      256,
      "lightgrey",
      "lightgrey"
    );
    svgGridHelper.position.y = -0.5;
    svgScene.add(svgGridHelper);
  }

  const svgBoxGeometry = new THREE.BoxBufferGeometry(0.99, 0.99, 0.99);
  for (let x = 0; x < MAX_WIDTH; x++) {
    for (let y = 0; y < MAX_HEIGHT; y++) {
      for (let z = 0; z < MAX_DEPTH; z++) {
        if (vfull(x, y, z)) {
          const mesh = new THREE.Mesh(svgBoxGeometry, boxMaterial);
          mesh.position.set(
            x - MAX_WIDTH / 2,
            y - MAX_HEIGHT / 2,
            z - MAX_DEPTH / 2
          );
          svgScene.add(mesh);
        }
      }
    }
  }
  return svgScene;
}

function onInput() {
  const code = document.getElementById("code");
  instructions = code.value;
  buildGeometry();
}

const onDebouncedInput = debounce(onInput, 300);

document.getElementById("code").addEventListener("input", onDebouncedInput);

document.getElementById("save").addEventListener("click", () => {
  const codeArea = document.getElementById("code");
  const code = codeArea.value;
  db.collection("sketches")
    .add({
      code,
    })
    .then((docRef) => {
      console.log("Document written with ID: ", docRef.id);
      history.pushState({ sketchId: docRef.id }, "", `/?sketch=${docRef.id}`);
    })
    .catch((error) => {
      console.error("Error adding document: ", error);
      alert("Error getting sketch: " + error);
    });
});

document.getElementById("exportSvg").addEventListener("click", renderSvg);

const sketchId = document.location.search.split("?sketch=")[1];
// console.log(sketchId);
if (sketchId) {
  const docRef = db.collection("sketches").doc(sketchId);
  docRef
    .get()
    .then((doc) => {
      if (doc.exists) {
        const sketch = doc.data();
        document.getElementById("code").value = sketch.code;
        instructions = sketch.code;
        buildGeometry();
      } else {
        alert("Sketch not found.");
      }
    })
    .catch((error) => {
      console.log("Error getting document:", error);
      alert("Error getting sketch: " + error);
    });
}
