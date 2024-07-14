const CANVAS = document.getElementById("canvas");
const CONTEXT = CANVAS.getContext("2d");

CANVAS.width = window.innerWidth;
CANVAS.height = window.innerHeight;

export { CANVAS, CONTEXT };
