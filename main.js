// final project

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// webcam connection using WebRTC
window.onload = function(){
    const video = document.getElementById("myvideo");	
    video.onloadedmetadata = start_processing;
    const constraints = {audio: false, video: {facingMode: 'environment'}};
    navigator.mediaDevices.getUserMedia(constraints)
    .then((stream) => video.srcObject = stream )
    .catch((err) => {
        alert(err.name + ": " + err.message);	
        video.src = "marker.webm";
    });
}

let containers = {};

const models = { 
	//0: 'retro_cartoon_car.glb', 
	//6: { file: 'retro_cartoon_car2.glb', scale: .5 }, 
	//4: { file: 'choco_bunny2.glb',, scale: 1 } 
	4: { file: 'lampada.glb', scale: .01 },
	// 7: { file: 'gru_gru.glb', scale: .5 },
	11: { file: 'pink_pc.glb', scale: .01 },
	6:{ file: 'tape_whale.glb', scale: .01 },
	// 3: { file: 'lowpoly_fox.glb', scale: 1 },
	3: { file: 'pencil_case.glb', scale: .01 },
	7: { file: 'plant.glb', scale: .01 },
};

const loader = new GLTFLoader();
let objects = {};
const getModel = async (id) => {
	const obj = objects[id];
	if(obj == 'loading')
		return null;

	if(obj) return obj; // loaded

	const m = models[id];
	if(!m) {
		return null;
	}

	const path = 'models/' + m.file;
	console.log( 'loading model id %s from %s', id, path );
	objects[id] = 'loading';
	return new Promise((resolve, reject) => {
		loader.load(path, model => {
			model.scene.scale.set(m.scale, m.scale, m.scale);
			objects[id] = model;
			resolve(model);
		});
	})
}
let dbg = true;
const get_container = async (id) => {
	let c = containers[id];
	if(c) {
		c.lastdetectiontime = performance.now();
		c.first_detection = false;
		return c;
	}

	let model = await getModel(id);
	if(!model) {
		return null;
	}

	const container = new THREE.Object3D();
	container.matrixAutoUpdate = false;
	container.add(model.scene);

	const light = new THREE.AmbientLight(0xffffff,2);
	container.add(light);		
	// const axesHelper = new THREE.AxesHelper(1);
	// container.add(axesHelper);
	let k = { container: container, lastdetectiontime: performance.now(), first_detection: true };
	containers[id] = k;
	return k;
};

// fix the marker matrix to compensate Y-up models
function fixMatrix(three_mat, m){
    three_mat.set(
        m[0], m[8], -m[4], m[12],
        m[1], m[9], -m[5], m[13],
        m[2], m[10], -m[6], m[14],
        m[3], m[11], -m[7], m[15]
    );
}

function start_processing(){
    // canvas & video
    const video = document.getElementById("myvideo");
    const canvas = document.getElementById("mycanvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    video.width = video.height = 0;

    // three.js
    const renderer = new THREE.WebGLRenderer( { canvas: canvas } );
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    scene.add(camera);

    // background
    const bgtexture = new THREE.VideoTexture( video );
    bgtexture.colorSpace = THREE.SRGBColorSpace;
    scene.background = bgtexture;
	
    // container + object

    // jsartoolkit
    let arLoaded = false;
    let lastdetectiontime = 0;
    const arController = new ARController(video, 'camera_para.dat');
    arController.onload = () => {
		// debugger
        camera.projectionMatrix.fromArray( arController.getCameraMatrix() );
        arController.setPatternDetectionMode(artoolkit.AR_MATRIX_CODE_DETECTION);
        // arController.setMatrixCodeType(artoolkit.AR_MATRIX_CODE_3x3);
        arController.addEventListener('getMarker', ev => {
            if(ev.data.marker.idMatrix != -1){
				// console.log( "Marker Index: %s, Matrix id: %s", ev.data.index, ev.data.marker?.idMatrix );
				get_container(ev.data.marker.idMatrix).then( c => {
					if(!c) return;
					fixMatrix(c.container.matrix, ev.data.matrixGL_RH );
					if( c.first_detection )
						scene.add(c.container);

				})
            }
        });
        arLoaded = true;
    }

    // render loop
    function renderloop() {
        requestAnimationFrame( renderloop );
        if(arLoaded)
            arController.process(video);
		const now = performance.now();
		let ixs = Object.keys(containers);
		// debugger
		for( let i = 0; i < ixs.length; i++ ) {
			const k = ixs[i];
			let c = containers[k];
			if( now - c.lastdetectiontime < 100 )
				c.container.visible = true;
			else
			    c.container.visible = false;
		}
        // if(performance.now()-lastdetectiontime < 100)
        renderer.render( scene, camera );
    }
    renderloop();
}

