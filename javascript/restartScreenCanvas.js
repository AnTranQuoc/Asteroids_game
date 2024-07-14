import { CANVAS, CONTEXT } from "./canvasUtils.js";
import { score, bestScore } from "./scoreUtils.js";
import { OFF_WHITE, TRANSLUCENT } from "./gameConstants.js";

export function drawRestartScreenInfo() {
  CONTEXT.fillStyle = TRANSLUCENT;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.font = "30px monospace";

  const mainMessageText = "You have been hit by an asteroid!";
  const mainMessageWidth = CONTEXT.measureText(mainMessageText).width;
  const mainMessageX = (CANVAS.width - mainMessageWidth) / 2;
  const mainMessageY = CANVAS.height / 2 - 70;
  CONTEXT.fillText(mainMessageText, mainMessageX, mainMessageY);

  const scoreText = `Your score was ${score}.`;
  const scoreWidth = CONTEXT.measureText(scoreText).width;
  const scoreX = (CANVAS.width - scoreWidth) / 2;
  const scoreY = CANVAS.height / 2 + 10;
  CONTEXT.fillText(scoreText, scoreX, scoreY);

  const bestScoreText = `The score to beat is ${bestScore}.`;
  const bestScoreWidth = CONTEXT.measureText(bestScoreText).width;
  const bestScoreX = (CANVAS.width - bestScoreWidth) / 2;
  const bestScoreY = CANVAS.height / 2 - 30;
  CONTEXT.fillText(bestScoreText, bestScoreX, bestScoreY);

  CONTEXT.font = "20px monospace";
  // const controlsText = "W - Forwards | A - Rotate Left | S - Backwards | D - Rotate Right | ESC - Pause";
  // const controlsWidth = CONTEXT.measureText(controlsText).width;
  // const controlsX = (CANVAS.width - controlsWidth) / 2;
  // const controlsY = CANVAS.height / 2 + 125;
  // CONTEXT.fillText(controlsText, controlsX, controlsY);

  const playAgainText = "Press the LEFT MOUSE BUTTON to play again.";
  const playAgainWidth = CONTEXT.measureText(playAgainText).width;
  const playAgainX = (CANVAS.width - playAgainWidth) / 2;
  const playAgainY = CANVAS.height / 2 + 160;
  CONTEXT.fillText(playAgainText, playAgainX, playAgainY);

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
