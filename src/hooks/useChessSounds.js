import moveSoundFile from "../assets/sounds/move.mp3";
import captureSoundFile from "../assets/sounds/capture.mp3";
import checkSoundFile from "../assets/sounds/check.mp3";
import castleSoundFile from "../assets/sounds/castle.mp3";
import promoteSoundFile from "../assets/sounds/promote.mp3";
import gameEndSoundFile from "../assets/sounds/game-end.mp3";

const moveSound = new Audio(moveSoundFile);
const captureSound = new Audio(captureSoundFile);
const checkSound = new Audio(checkSoundFile);
const castleSound = new Audio(castleSoundFile);
const promoteSound = new Audio(promoteSoundFile);
const gameEndSound = new Audio(gameEndSoundFile);

const useChessSounds = () => {

  const playMoveSound = () => {
    moveSound.currentTime = 0;
    moveSound.play();
  };

  const playCaptureSound = () => {
    captureSound.currentTime = 0;
    captureSound.play();
  };

  const playCheckSound = () => {
    checkSound.currentTime = 0;
    checkSound.play();
  };

  const playCastleSound = () => {
    castleSound.currentTime = 0;
    castleSound.play();
  };

  const playPromoteSound = () => {
    promoteSound.currentTime = 0;
    promoteSound.play();
  };

  const playGameEndSound = () => {
    gameEndSound.currentTime = 0;
    gameEndSound.play();
  };

  return {
    playMoveSound,
    playCaptureSound,
    playCheckSound,
    playCastleSound,
    playPromoteSound,
    playGameEndSound,
  };
};

export default useChessSounds;