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

const volume = new Uint8Array(MAX_WIDTH * MAX_HEIGHT * MAX_DEPTH);

let currentGroup = 1;

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

const gridHelper = new THREE.GridHelper(500, 500, "lightgrey", "lightgrey");
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
  camera.aspect = globalSize.width / globalSize.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(globalSize.width, globalSize.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

const camera = new THREE.PerspectiveCamera(
  75,
  globalSize.width / globalSize.height,
  1,
  1024
);
camera.position.y = 5;
camera.position.z = 15;
scene.add(camera);

const controls = new THREE.OrbitControls(camera, canvas);

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});

renderer.setSize(globalSize.width, globalSize.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

function animate() {
  renderer.render(scene, camera);
  window.requestAnimationFrame(animate);
}
animate();

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

  // let geometry;
  for (let line = 1; line <= lines.length; line++) {
    const [command, ...args] = lines[line - 1].trim().split(/\s+/);
    if (command === "box") {
      if (args.length !== 3) {
        setError(`Line ${line}: box needs three arguments, e.g. box 2 4 5`);
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
    } else if (command === "plane") {
      if (args.length !== 2) {
        setError(`Line ${line}: plane needs two arguments, e.g. plane 4 8`);
        return;
      }
      const width = parseInt(args[0]);
      const depth = parseInt(args[1]);
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < depth; z++) {
          vset(tx + x, ty, tz + z);
        }
      }
    } else if (command === "extrude") {
      if (args.length !== 1 && args.length !== 3) {
        setError(
          `Line ${line}: extrude needs one or three arguments, e.g. 'extrude 10' or 'extrude 10 group 3'`
        );
        return;
      }
      let groupToCheck = -1;
      if (args.length === 3) {
        if (args[1] !== "group") {
          setError(
            `Line ${line}: extrude needs a group argument, e.g. 'extrude 10 group 3'`
          );
          return;
        }
        groupToCheck = parseInt(args[2]);
        if (groupToCheck === 0) {
          setError(`Line ${line}: extrude group can not be zero.`);
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
    } else if (command === "translate") {
      if (args.length !== 3) {
        setError(
          `Line ${line}: translate needs three arguments, e.g. translate 2 4 5`
        );
        return;
      }
      tx += parseInt(args[0]);
      ty += parseInt(args[1]);
      tz += parseInt(args[2]);
    } else if (command === "reset") {
      tx = Math.round(MAX_WIDTH / 2);
      ty = Math.round(MAX_HEIGHT / 2);
      tz = Math.round(MAX_DEPTH / 2);
    } else if (command === "lsys") {
      rule = args[0];
      buildLSystem(rule, tx, ty, tz);
    } else if (command === "name") {
      rule = args[0];
      buildNameSystem(rule, tx, ty, tz);
    } else if (command === "group") {
      if (args.length !== 1) {
        setError(`Line ${line}: group needs one argument, e.g. group 5`);
        return;
      }
      currentGroup = parseInt(args[0]);
    } else if (command === "material") {
      if (args.length !== 1) {
        setError(
          `Line ${line}: material needs one argument, e.g. material wireframe`
        );
        return;
      }
      if (args[0] === "wireframe") {
        boxMaterial = new THREE.MeshBasicMaterial({ color: "white" });
        boxMaterial.wireframe = true;
      } else if (args[0] === "matcap") {
        boxMaterial = new THREE.MeshMatcapMaterial();
        boxMaterial.matcap = matcapTexture;
      } else if (args[0] === "solid") {
        boxMaterial = new THREE.MeshBasicMaterial({ color: "black" });
      } else {
        setError(`Line ${line}: material got an unknown argument.`);
        return;
      }
    } else if (command === "background") {
      if (args.length !== 1) {
        setError(
          `Line ${line}: background needs one argument, e.g. background black`
        );
        return;
      }
      scene.background = new THREE.Color(args[0]);
    } else if (command === "grid") {
      if (args.length !== 1) {
        setError(`Line ${line}: grid needs one argument, e.g. grid on`);
        return;
      }
      if (args[0] === "on") {
        gridHelper.visible = true;
      } else if (args[0] === "off") {
        gridHelper.visible = false;
      } else {
        setError(`Line ${line}: grid got an unknown argument.`);
        return;
      }
    } else if (command.trim() === "" || command.trim()[0] === "#") {
      // Empty line or comment
    } else {
      setError(`Line ${line}: unknown command "${command}".`);
      return;
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

document.getElementById("code").addEventListener("input", (e) => {
  instructions = e.target.value;
  buildGeometry();
});

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

const sketchId = document.location.search.split("?sketch=")[1];
console.log(sketchId);
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
