# Smoke simulation

WebGPU smoke cannon. A horizontal cannon emits continuously into a desert. Samples are stored on the GPU, splatted into a density grid, and raymarched as one volume.

```
npm install
npm run dev
```

Open http://127.0.0.1:5173/ in current Chrome or Edge with WebGPU. Press **Emit smoke**.

`main` is this smoke app. The `preview` branch keeps the wider proving-ground scene. The Blender project is not in this repository.
