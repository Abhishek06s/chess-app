import moveSoundFile from "../assets/sounds/move.mp3";
import captureSoundFile from "../assets/sounds/capture.mp3";
import checkSoundFile from "../assets/sounds/check.mp3";
import castleSoundFile from "../assets/sounds/castle.mp3";
import promoteSoundFile from "../assets/sounds/promote.mp3";
import gameEndSoundFile from "../assets/sounds/game-end.mp3";
import gameStartSoundFile from "../assets/sounds/game-start.mp3";

const createBaseAudio = (src) => {
  const audio = new Audio(src);
  audio.preload = "auto";
  return audio;
};

const moveSound = createBaseAudio(moveSoundFile);
const captureSound = createBaseAudio(captureSoundFile);
const checkSound = createBaseAudio(checkSoundFile);
const castleSound = createBaseAudio(castleSoundFile);
const promoteSound = createBaseAudio(promoteSoundFile);
const gameEndSound = createBaseAudio(gameEndSoundFile);
const gameStartSound = createBaseAudio(gameStartSoundFile);


const safePlay = (audioInstance) => {
  try {
    const node = audioInstance.cloneNode(true);
    const playPromise = node.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        console.warn(
          `[Audio] Playback deferred on ${audioInstance.src.split("/").pop()}: user interaction required.`,
        );
      });
    }

    node.addEventListener("ended", () => {
      node.src = "";
    });
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