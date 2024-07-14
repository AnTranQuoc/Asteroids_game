import { CANVAS, CONTEXT } from "./canvasUtils.js";
import { OFF_WHITE, GREY } from "./gameConstants.js";

export function drawStartScreenInfo() {
  CONTEXT.fillStyle = GREY;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.font = "200px monospace";

  const titleText = "ASTEROIDS";
  const titleWidth = CONTEXT.measureText(titleText).width;
  const titleX = (CANVAS.width - titleWidth) / 2;
  const titleY = CANVAS.height / 2 - 80;
  CONTEXT.fillText(titleText, titleX, titleY);

  CONTEXT.font = "20px monospace";
  const controlsText = "W - Forwards | A - Rotate Left | S - Backwards | D - Rotate Right | ESC - Pause";
  const controlsWidth = CONTEXT.measureText(controlsText).width;
  const controlsX = (CANVAS.width - controlsWidth) / 2;
  const controlsY = CANVAS.height / 2 + 160;
  CONTEXT.fillText(controlsText, controlsX, controlsY);

  const instructionText = "Press the LEFT MOUSE BUTTON to start the game.";
  const instructionWidth = CONTEXT.measureText(instructionText).width;
  const instructionX = (CANVAS.width - instructionWidth) / 2;
  const instructionY = CANVAS.height / 2 + 125;
  CONTEXT.fillText(instructionText, instructionX, instructionY);

  CONTEXT.font = "14px monospace";
  const scoreGuideText = "Note: Smaller asteroids are worth more than larger ones. Will you risk it?";
  const scoreGuideWidth = CONTEXT.measureText(scoreGuideText).width;
  const scoreGuideX = (CANVAS.width - scoreGuideWidth) / 2;
  const scoreGuideY = CANVAS.height / 2 + 190;
  CONTEXT.fillText(scoreGuideText, scoreGuideX, scoreGuideY);

  const musicText = "Music by Karl Casey. (Royalty-Free)";
  const musicWidth = CONTEXT.measureText(musicText).width;
  const musicX = (CANVAS.width - musicWidth) / 2;
  const musicY = CANVAS.height / 2 + 430;
  CONTEXT.fillText(musicText, musicX, musicY);

  const musicWebsiteText = "karlcasey.bandcamp.com";
  const musicWebsiteWidth = CONTEXT.measureText(musicWebsiteText).width;
  const musicWebsiteX = (CANVAS.width - musicWebsiteWidth) / 2;
  const musicWebsiteY = CANVAS.height / 2 + 450;
  CONTEXT.fillText(musicWebsiteText, musicWebsiteX, musicWebsiteY);
}
