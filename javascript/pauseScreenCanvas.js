import { CANVAS, CONTEXT } from "./canvasUtils.js";
import { score } from "./scoreUtils.js";
import { OFF_WHITE, TRANSLUCENT } from "./gameConstants.js";

export function drawPauseMenuInfo() {
  CONTEXT.fillStyle = TRANSLUCENT;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.font = "30px monospace";

  const pausedText = "GAME PAUSED";
  const pausedWidth = CONTEXT.measureText(pausedText).width;
  const pausedX = (CANVAS.width - pausedWidth) / 2;
  const pausedY = CANVAS.height / 2 - 70;
  CONTEXT.fillText(pausedText, pausedX, pausedY);

  const scoreText = `Your score is currently ${score}.`;
  const scoreWidth = CONTEXT.measureText(scoreText).width;
  const scoreX = (CANVAS.width - scoreWidth) / 2;
  const scoreY = CANVAS.height / 2 - 30;
  CONTEXT.fillText(scoreText, scoreX, scoreY);

  CONTEXT.font = "20px monospace";
  const controlsText =
    "W - Forwards | A - Rotate Left | S - Backwards | D - Rotate Right";
  const controlsWidth = CONTEXT.measureText(controlsText).width;
  const controlsX = (CANVAS.width - controlsWidth) / 2;
  const controlsY = CANVAS.height / 2 + 160;
  CONTEXT.fillText(controlsText, controlsX, controlsY);

  const resumeText = "Press the LEFT MOUSE BUTTON to resume playing.";
  const resumeWidth = CONTEXT.measureText(resumeText).width;
  const resumeX = (CANVAS.width - resumeWidth) / 2;
  const resumeY = CANVAS.height / 2 + 125;
  CONTEXT.fillText(resumeText, resumeX, resumeY);

  CONTEXT.font = "14px monospace";
  const scoreGuideText =
    "Note: Smaller asteroids are worth more than larger ones. Will you risk it?";
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
