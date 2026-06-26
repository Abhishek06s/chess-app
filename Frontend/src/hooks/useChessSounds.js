import moveSoundFile from "../assets/sounds/move.mp3";
import captureSoundFile from "../assets/sounds/capture.mp3";
import checkSoundFile from "../assets/sounds/check.mp3";
import castleSoundFile from "../assets/sounds/castle.mp3";
import promoteSoundFile from "../assets/sounds/promote.mp3";
import gameEndSoundFile from "../assets/sounds/game-end.mp3";
import gameStartSoundFile from "../assets/sounds/game-start.mp3";

const moveSound = new Audio(moveSoundFile);
const captureSound = new Audio(captureSoundFile);
const checkSound = new Audio(checkSoundFile);
const castleSound = new Audio(castleSoundFile);
const promoteSound = new Audio(promoteSoundFile);
const gameEndSound = new Audio(gameEndSoundFile);
const gameStartSound = new Audio(gameStartSoundFile);

const safePlay = (audioInstance) => {
  try {
    audioInstance.currentTime = 0;
    const playPromise = audioInstance.play();
    
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.warn(
          `[Audio] Playback deferred on ${audioInstance.src.split('/').pop()}: User interaction required.`
        );
      });
    }
  } catch (err) {
    console.error("[Audio] Sound engine execution failure:", err);
  }
};

const useChessSounds = () => {
  const playMoveSound = () => safePlay(moveSound);
  const playCaptureSound = () => safePlay(captureSound);
  const playCheckSound = () => safePlay(checkSound);
  const playCastleSound = () => safePlay(castleSound);
  const playPromoteSound = () => safePlay(promoteSound);
  const playGameEndSound = () => safePlay(gameEndSound);
  const playGameStartSound = () => safePlay(gameStartSound);

  return {
    playMoveSound,
    playCaptureSound,
    playCheckSound,
    playCastleSound,
    playPromoteSound,
    playGameEndSound,
    playGameStartSound,
  };
};

export default useChessSounds;